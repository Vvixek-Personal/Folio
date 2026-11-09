import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, workspaceMembers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { serializeTask } from "@/lib/serialize";
import { enumField, isIsoDate, nullableTextField, readJsonBody, stripFields, textField } from "@/lib/validate";
import { getWorkspaceForUser } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_TITLE = 180;
const MAX_DESCRIPTION = 3000;
const MAX_PROJECT = 80;

const TASK_STATUSES = ["todo", "doing", "done"];
const TASK_PRIORITIES = ["low", "medium", "high"];

// Relational and server-managed columns: never sourced from a request body.
const PROTECTED_TASK_FIELDS = [
  "id",
  "workspaceId",
  "createdBy",
  "createdAt",
  "updatedAt",
  "position",
] as const;

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to update this task." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const { id } = await context.params;

  // Tenant isolation first: the task must belong to the caller's active
  // workspace before any payload or nested assignee check is evaluated.
  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, workspace.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Task not found." }, { status: 404 });

  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  }
  stripFields(body, PROTECTED_TASK_FIELDS);

  const values: Partial<typeof tasks.$inferInsert> = {};
  const detail: string[] = [];

  const title = textField(body, "title", MAX_TITLE);
  if (title !== undefined) {
    if (title.length < 1) return NextResponse.json({ error: "Task title cannot be empty." }, { status: 400 });
    if (title !== existing.title) values.title = title;
  }

  const description = textField(body, "description", MAX_DESCRIPTION);
  if (description !== undefined && description !== existing.description) values.description = description;

  const project = textField(body, "project", MAX_PROJECT);
  if (project !== undefined) {
    const nextProject = project.length > 0 ? project : "Workspace";
    if (nextProject !== existing.project) values.project = nextProject;
  }

  const status = enumField(body, "status", TASK_STATUSES);
  if (status !== undefined && status !== existing.status) {
    values.status = status;
    detail.push(`to ${status === "doing" ? "In progress" : status === "done" ? "Done" : "To do"}`);
  }

  const priority = enumField(body, "priority", TASK_PRIORITIES);
  if (priority !== undefined && priority !== existing.priority) {
    values.priority = priority;
    detail.push(`priority ${priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low"}`);
  }

  if ("dueDate" in body) {
    const dueDate = nullableTextField(body, "dueDate", 10);
    if (dueDate === undefined) return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
    if (dueDate && !isIsoDate(dueDate)) return NextResponse.json({ error: "Enter a valid due date." }, { status: 400 });
    if (dueDate !== existing.dueDate) values.dueDate = dueDate;
  }

  if ("assigneeId" in body) {
    const assigneeId = nullableTextField(body, "assigneeId", 64);
    if (assigneeId === undefined) return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
    if (assigneeId !== existing.assigneeId) values.assigneeId = assigneeId;
  }

  // Nothing actually changed: skip the write entirely.
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ task: serializeTask(existing) });
  }

  if (values.assigneeId) {
    const [membership] = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, values.assigneeId)))
      .limit(1);
    if (!membership) return NextResponse.json({ error: "Choose someone on this workspace." }, { status: 400 });
  }

  values.updatedAt = new Date();
  const [updated] = await db
    .update(tasks)
    .set(values)
    .where(and(eq(tasks.id, existing.id), eq(tasks.workspaceId, workspace.id)))
    .returning();
  if (!updated) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  recordActivity({
    workspaceId: workspace.id,
    actorId: user.id,
    type: existing.status !== "done" && updated.status === "done" ? "task_completed" : "task_updated",
    targetType: "task",
    targetId: updated.id,
    summary: updated.title,
    detail: detail.join(" · ") || null,
  });

  return NextResponse.json({ task: serializeTask(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete this task." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const { id } = await context.params;

  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, workspace.id)))
    .returning({ id: tasks.id });
  if (!deleted) return NextResponse.json({ error: "Task not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
