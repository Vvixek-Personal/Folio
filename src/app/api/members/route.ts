import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, workspaceInvitations, workspaceMembers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isEmail, readJsonBody, stripFields, textField } from "@/lib/validate";
import { getWorkspaceForUser } from "@/lib/workspace";

const INVITE_TTL_DAYS = 7;

// Invitation security fields are server-generated only.
const PROTECTED_INVITATION_FIELDS = [
  "id",
  "workspaceId",
  "invitedBy",
  "tokenHash",
  "role",
  "expiresAt",
  "acceptedAt",
  "createdAt",
] as const;

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function managerContext() {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in to manage your team." }, { status: 401 }) };
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return { response: NextResponse.json({ error: "No workspace found." }, { status: 404 }) };

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id)))
    .limit(1);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { response: NextResponse.json({ error: "Only workspace owners can manage invitations." }, { status: 403 }) };
  }
  return { user, workspace };
}

export async function GET() {
  const context = await managerContext();
  if ("response" in context) return context.response;

  const pending = await db
    .select({
      id: workspaceInvitations.id,
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      expiresAt: workspaceInvitations.expiresAt,
      createdAt: workspaceInvitations.createdAt,
    })
    .from(workspaceInvitations)
    .where(
      and(
        eq(workspaceInvitations.workspaceId, context.workspace.id),
        isNull(workspaceInvitations.acceptedAt),
        gt(workspaceInvitations.expiresAt, new Date()),
      ),
    );

  return NextResponse.json({
    invitations: pending.map((invite) => ({
      ...invite,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const context = await managerContext();
  if ("response" in context) return context.response;

  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  }
  stripFields(body, PROTECTED_INVITATION_FIELDS);

  const email = (textField(body, "email", 160) ?? "").toLowerCase();
  if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const [existingMember] = await db
    .select({ id: users.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(eq(workspaceMembers.workspaceId, context.workspace.id), eq(users.email, email)))
    .limit(1);
  if (existingMember) return NextResponse.json({ error: "That person is already on your team." }, { status: 409 });

  // One live invitation per email address per workspace.
  await db
    .delete(workspaceInvitations)
    .where(
      and(
        eq(workspaceInvitations.workspaceId, context.workspace.id),
        eq(workspaceInvitations.email, email),
        isNull(workspaceInvitations.acceptedAt),
      ),
    );

  const token = randomBytes(32).toString("base64url");
  const [invite] = await db
    .insert(workspaceInvitations)
    .values({
      workspaceId: context.workspace.id,
      invitedBy: context.user.id,
      email,
      tokenHash: tokenDigest(token),
      role: "member",
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning({
      id: workspaceInvitations.id,
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      expiresAt: workspaceInvitations.expiresAt,
    });

  const inviteUrl = new URL("/", request.url);
  inviteUrl.searchParams.set("invite", token);

  return NextResponse.json(
    { invite: { ...invite, expiresAt: invite.expiresAt.toISOString(), url: inviteUrl.toString() } },
    { status: 201 },
  );
}
