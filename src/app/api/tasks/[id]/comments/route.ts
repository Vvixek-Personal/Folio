import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { comments, tasks, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { readJsonBody, textField } from "@/lib/validate";
import { getWorkspaceForUser } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";


type RouteContext = { params: Promise<{ id: string }> };
const MAX_COMMENT = 2000;

/**
 * Resolves the caller and the task, enforcing that the task belongs to the
 * caller's active workspace before any payload is parsed.
 */
async function authorizedTask(context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in to view this discussion." }, { status: 401 }) };
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return { response: NextResponse.json({ error: "No workspace found." }, { status: 404 }) };

  const { id } = await context.params;
  const [task] = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, workspace.id)))
    .limit(1);
  if (!task) return { response: NextResponse.json({ error: "Task not found." }, { status: 404 }) };

  return { user, task, workspace };
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await authorizedTask(context);
  if ("response" in access) return access.response;

  const rows = await db
    .select({
      id: comments.id,
      taskId: comments.taskId,
      userId: comments.userId,
      userName: users.name,
      avatarColor: users.avatarColor,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.taskId, access.task.id))
    .orderBy(asc(comments.createdAt));

  return NextResponse.json({
    comments: rows.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const access = await authorizedTask(context);
  if ("response" in access) return access.response;

  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  }

  const text = textField(body, "body", MAX_COMMENT) ?? "";
  if (text.length < 1) return NextResponse.json({ error: "Write a note before posting." }, { status: 400 });

  const [comment] = await db
    .insert(comments)
    .values({ taskId: access.task.id, userId: access.user.id, body: text })
    .returning();
  recordActivity({ workspaceId: access.workspace.id, actorId: access.user.id, type: "comment_added", targetType: "task", targetId: access.task.id, summary: access.task.title, detail: text });

  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        taskId: comment.taskId,
        userId: access.user.id,
        userName: access.user.name,
        avatarColor: access.user.avatarColor,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
