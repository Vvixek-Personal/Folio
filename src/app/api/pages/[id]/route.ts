import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isSafePageContent } from "@/lib/page-content";
import { serializePage } from "@/lib/serialize";
import { booleanField, enumField, rawString, readJsonBody, stripFields, textField } from "@/lib/validate";
import { getWorkspaceForUser } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";


type RouteContext = { params: Promise<{ id: string }> };
const COVERS = ["sage", "clay", "sand", "sky", "olive", "none"];
const PROTECTED_FIELDS = ["id", "workspaceId", "createdBy", "parentId", "createdAt", "updatedAt"] as const;

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to edit this page." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const { id } = await context.params;
  const [existing] = await db.select().from(pages).where(and(eq(pages.id, id), eq(pages.workspaceId, workspace.id))).limit(1);
  if (!existing) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  }
  stripFields(body, PROTECTED_FIELDS);
  const values: Partial<typeof pages.$inferInsert> = {};
  const title = textField(body, "title", 160);
  if (title !== undefined) {
    if (!title) return NextResponse.json({ error: "Page title cannot be empty." }, { status: 400 });
    if (title !== existing.title) values.title = title;
  }
  const icon = textField(body, "icon", 12);
  if (icon !== undefined && (icon || "file") !== existing.icon) values.icon = icon || "file";
  const cover = enumField(body, "cover", COVERS);
  if (cover !== undefined && cover !== existing.cover) values.cover = cover;
  const rawContent = rawString(body, "content");
  if (rawContent !== undefined) {
    const content = rawContent.trim();
    if (content.length > 100000) return NextResponse.json({ error: "This page is too long to save." }, { status: 400 });
    if (!isSafePageContent(content)) return NextResponse.json({ error: "The page contains unsupported formatting or an unsafe link." }, { status: 400 });
    if (content !== existing.content) values.content = content;
  }
  const favorite = booleanField(body, "isFavorite");
  if (favorite !== undefined && favorite !== (existing.isFavorite === "true")) values.isFavorite = favorite ? "true" : "false";
  if (!Object.keys(values).length) return NextResponse.json({ page: serializePage(existing) });
  values.updatedAt = new Date();
  const [updated] = await db.update(pages).set(values).where(and(eq(pages.id, existing.id), eq(pages.workspaceId, workspace.id))).returning();
  if (!updated) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  recordActivity({ workspaceId: workspace.id, actorId: user.id, type: "page_updated", targetType: "page", targetId: updated.id, summary: updated.title });
  return NextResponse.json({ page: serializePage(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete this page." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const { id } = await context.params;
  const [existing] = await db.select({ id: pages.id, title: pages.title }).from(pages).where(and(eq(pages.id, id), eq(pages.workspaceId, workspace.id))).limit(1);
  if (!existing) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  await db.delete(pages).where(and(eq(pages.id, existing.id), eq(pages.workspaceId, workspace.id)));
  recordActivity({ workspaceId: workspace.id, actorId: user.id, type: "page_deleted", targetType: "page", targetId: existing.id, summary: existing.title });
  return NextResponse.json({ ok: true });
}
