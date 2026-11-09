import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enumField, readJsonBody, stripFields, textField } from "@/lib/validate";
import { getWorkspaceForUser, getWorkspaceSnapshot } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";


const CURRENCIES = ["INR", "USD", "GBP", "EUR", "SGD", "AUD"] as const;
const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Singapore",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
] as const;

// Identity and ownership columns are server-managed.
const PROTECTED_WORKSPACE_FIELDS = ["id", "ownerId", "createdAt"] as const;

async function managerContext() {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in to access this workspace." }, { status: 401 }) };
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return { response: NextResponse.json({ error: "No workspace found." }, { status: 404 }) };

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id)))
    .limit(1);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { response: NextResponse.json({ error: "Only workspace owners can change these settings." }, { status: 403 }) };
  }
  return { user, workspace };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to access this workspace." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });

  const snapshot = await getWorkspaceSnapshot(workspace.id);
  return NextResponse.json(snapshot);
}

export async function PATCH(request: Request) {
  const context = await managerContext();
  if ("response" in context) return context.response;
  const workspace = context.workspace;

  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  }
  stripFields(body, PROTECTED_WORKSPACE_FIELDS);

  const name = textField(body, "name", 80);
  if (name !== undefined && name.length < 2) {
    return NextResponse.json({ error: "Workspace name must be at least 2 characters." }, { status: 400 });
  }

  const currency = enumField(body, "currency", CURRENCIES);
  const timezone = enumField(body, "timezone", TIMEZONES);

  const values: Partial<typeof workspaces.$inferInsert> = {};
  if (name !== undefined && name !== workspace.name) values.name = name;
  if (currency !== undefined && currency !== workspace.currency) values.currency = currency;
  if (timezone !== undefined && timezone !== workspace.timezone) values.timezone = timezone;

  // Nothing actually changed: skip the write entirely.
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ workspace });
  }

  await db.update(workspaces).set(values).where(eq(workspaces.id, workspace.id));
  if (values.name) recordActivity({ workspaceId: workspace.id, actorId: context.user.id, type: "workspace_renamed", summary: values.name });
  return NextResponse.json({ workspace: { ...workspace, ...values } });
}
