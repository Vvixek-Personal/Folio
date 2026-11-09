import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, workspaceMembers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { serializeTask } from "@/lib/serialize";
import { enumField, isIsoDate, nullableTextField, readJsonBody, stripFields, textField } from "@/lib/validate";
import { getWorkspaceForUser } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";


const MAX_TITLE = 180;
const MAX_DESCRIPTION = 3000;
const MAX_PROJECT = 80;

const TASK_STATUSES = ["todo", "doing", "done"] as const;
const TASK_PRIORITIES = ["low", "medium", "high"] as const;

// Relational and server-managed columns: never sourced from a request body.
const PROTECTED_TASK_FIELDS = [
  "id",
  "workspaceId",
  "createdBy",
  "createdAt",
  "updatedAt",
  "position",
] as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to access your tasks." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });

  const rows = await db.select().from(tasks).where(eq(tasks.workspaceId, workspace.id)).orderBy(asc(tasks.position));
  return NextResponse.json({ tasks: rows.map(serializeTask) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a task." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });

  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  }
  stripFields(body, PROTECTED_TASK_FIELDS);

  const title = textField(body, "title", MAX_TITLE) ?? "";
  const description = textField(body, "description", MAX_DESCRIPTION) ?? "";
  const project = textField(body, "project", MAX_PROJECT) ?? "Workspace";
  const status = enumField(body, "status", TASK_STATUSES) ?? "todo";
  const priority = enumField(body, "priority", TASK_PRIORITIES) ?? "medium";
  const dueDate = nullableTextField(body, "dueDate", 10) ?? null;
  const assignee = nullableTextField(body, "assigneeId", 64);
  const assigneeId = assignee === undefined ? user.id : assignee;

  if (title.length < 1) return NextResponse.json({ error: "Give your task a title first." }, { status: 400 });
  if (dueDate && !isIsoDate(dueDate)) return NextResponse.json({ error: "Enter a valid due date." }, { status: 400 });

  if (assigneeId) {
    const [membership] = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, assigneeId)))
      .limit(1);
    if (!membership) return NextResponse.json({ error: "Choose someone on this workspace." }, { status: 400 });
  }

  const [task] = await db
    .insert(tasks)
    .values({
      workspaceId: workspace.id,
      createdBy: user.id,
      assigneeId,
      title,
      description,
      project,
      status,
      priority,
      dueDate,
      position: Math.floor(Date.now() / 1000),
    })
    .returning();

  recordActivity({ workspaceId: workspace.id, actorId: user.id, type: "task_created", targetType: "task", targetId: task.id, summary: task.title });
  return NextResponse.json({ task: serializeTask(task) }, { status: 201 });
}
