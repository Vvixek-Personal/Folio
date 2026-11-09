import { and, asc, desc, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { pages, tasks, users, workspaceMembers, workspaces } from "@/db/schema";
import type { WorkspaceSnapshot } from "@/lib/types";

export const ACTIVE_WORKSPACE_COOKIE = "folio_workspace";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getWorkspacesForUser(userId: string) {
  return db
    .select({ id: workspaces.id, name: workspaces.name, currency: workspaces.currency, timezone: workspaces.timezone, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaceMembers.joinedAt));
}

export async function getWorkspaceForUser(userId: string, preferredId?: string | null) {
  const headerId = (await headers()).get("x-folio-workspace");
  const cookieId = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const requestedId = [headerId, preferredId, cookieId].find((value) => Boolean(value) && UUID_PATTERN.test(String(value)));
  if (requestedId) {
    // The cookie is only a preference: membership is always checked in SQL.
    const [selected] = await db
      .select({ id: workspaces.id, name: workspaces.name, currency: workspaces.currency, timezone: workspaces.timezone })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, requestedId)))
      .limit(1);
    if (selected) return selected;
  }
  const [fallback] = await getWorkspacesForUser(userId);
  return fallback ?? null;
}

/**
 * Returns the caller's workspace, creating an empty one when an account has
 * none (for example an account created before a workspace existed).
 * No sample content is ever inserted here.
 */
export async function ensureWorkspaceForUser(userId: string, displayName: string, preferredId?: string | null) {
  const existing = await getWorkspaceForUser(userId, preferredId);
  if (existing) return existing;

  const firstName = displayName.trim().split(/\s+/)[0] || "Your";
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: `${firstName}’s workspace`, ownerId: userId })
    .returning({ id: workspaces.id, name: workspaces.name, currency: workspaces.currency, timezone: workspaces.timezone });
  await db
    .insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId, role: "owner" })
    .onConflictDoNothing();
  return workspace;
}

export async function getWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot | null> {
  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name, currency: workspaces.currency, timezone: workspaces.timezone })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return null;

  const [members, pageRows, taskRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarColor: users.avatarColor,
        isGuest: users.isGuest,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId)),
    db.select().from(pages).where(eq(pages.workspaceId, workspaceId)).orderBy(desc(pages.updatedAt)),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        project: tasks.project,
        dueDate: tasks.dueDate,
        assigneeId: tasks.assigneeId,
        assigneeName: users.name,
        assigneeColor: users.avatarColor,
        position: tasks.position,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(eq(tasks.workspaceId, workspaceId))
      .orderBy(asc(tasks.position)),
  ]);

  return {
    workspace,
    members: members.map((member) => ({ ...member, email: member.isGuest ? "Guest session · this browser" : member.email })),
    pages: pageRows.map((page) => ({
      id: page.id,
      title: page.title,
      icon: page.icon,
      cover: page.cover,
      content: page.content,
      isFavorite: page.isFavorite === "true",
      updatedAt: page.updatedAt.toISOString(),
    })),
    tasks: taskRows.map((task) => ({
      ...task,
      status: task.status as "todo" | "doing" | "done",
      priority: task.priority as "low" | "medium" | "high",
      dueDate: task.dueDate,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
  };
}
