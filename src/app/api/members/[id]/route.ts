import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, workspaceMembers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";


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
