import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, workspaceMembers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";
import { readJsonBody, textField } from "@/lib/validate";


type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage your team." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id)))
    .limit(1);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only workspace owners can update the team." }, { status: 403 });
  }
  const { id } = await context.params;
  const [member] = await db
    .select({ name: users.name })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, id)))
    .limit(1);
  const [removed] = await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, id), eq(workspaceMembers.role, "member")))
    .returning({ userId: workspaceMembers.userId });
  if (!removed) return NextResponse.json({ error: "Only a non-owner workspace member can be removed." }, { status: 404 });
  recordActivity({ workspaceId: workspace.id, actorId: user.id, type: "member_removed", targetType: "member", summary: member?.name ?? null });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage your team." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const [actor] = await db.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).limit(1);
  if (!actor || actor.role !== "owner") return NextResponse.json({ error: "Only the workspace owner can change roles." }, { status: 403 });
  const { id } = await context.params;
  if (id === user.id) return NextResponse.json({ error: "You cannot change your own owner role." }, { status: 400 });
  const body = await readJsonBody(request);
  const role = body && typeof body === "object" && !Array.isArray(body) ? textField(body, "role", 20) : null;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Role must be admin or member." }, { status: 400 });
  const [updated] = await db.update(workspaceMembers).set({ role }).where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, id), sql`${workspaceMembers.role} <> 'owner'`)).returning({ userId: workspaceMembers.userId, role: workspaceMembers.role });
  if (!updated) return NextResponse.json({ error: "That member could not be updated." }, { status: 404 });
  recordActivity({ workspaceId: workspace.id, actorId: user.id, type: "member_role_changed", targetType: "member", targetId: id, detail: `Role changed to ${role}` });
  return NextResponse.json({ ok: true, role: updated.role });
}
