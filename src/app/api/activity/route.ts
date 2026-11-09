import { and, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activity, users, workspaceMembers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/workspace";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to view activity." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 40);
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitParam) ? limitParam : 40));
  const beforeParam = url.searchParams.get("before");

  const conditions = [eq(activity.workspaceId, workspace.id)];
  if (beforeParam) {
    const before = new Date(beforeParam);
    if (!Number.isNaN(before.getTime())) conditions.push(lt(activity.createdAt, before));
  }

  const [membershipRows, rows] = await Promise.all([
    db
      .select({ readAt: workspaceMembers.activityReadAt })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id)))
      .limit(1),
    db
      .select({
        id: activity.id,
        type: activity.type,
        targetType: activity.targetType,
        targetId: activity.targetId,
        summary: activity.summary,
        detail: activity.detail,
        createdAt: activity.createdAt,
        actorId: activity.actorId,
        actorName: users.name,
        actorColor: users.avatarColor,
      })
      .from(activity)
      .leftJoin(users, eq(activity.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(activity.createdAt), desc(activity.id))
      .limit(limit),
  ]);

  // Unread = teammate activity since this member last looked (a null read
  // timestamp means "just now", so newcomers never inherit a noisy badge).
  const membership = membershipRows[0];
  let unreadCount = 0;
  if (membership?.readAt) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(activity)
      .where(
        and(
          eq(activity.workspaceId, workspace.id),
          gt(activity.createdAt, membership.readAt),
          ne(activity.actorId, user.id),
        ),
      );
    unreadCount = row?.count ?? 0;
  }

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      targetType: row.targetType,
      targetId: row.targetId,
      summary: row.summary,
      detail: row.detail,
      createdAt: row.createdAt.toISOString(),
      actor: row.actorId
        ? { id: row.actorId, name: row.actorName ?? "A teammate", avatarColor: row.actorColor ?? "#e8e7e3" }
        : { id: "", name: "A teammate", avatarColor: "#e8e7e3" },
    })),
    unreadCount,
  });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to mark activity as read." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });

  await db
    .update(workspaceMembers)
    .set({ activityReadAt: new Date() })
    .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id)));

  return NextResponse.json({ ok: true });
}
