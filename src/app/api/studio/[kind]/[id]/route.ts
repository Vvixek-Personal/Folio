import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteStudioItem, readStudioBody, updateStudioItem } from "@/lib/studio";
import { STUDIO_KINDS, type StudioKind } from "@/lib/studio-types";
import { getWorkspaceForUser } from "@/lib/workspace";

type RouteContext = { params: Promise<{ kind: string; id: string }> };

async function contextFor(context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in to change this." }, { status: 401 }) };
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return { response: NextResponse.json({ error: "No workspace found." }, { status: 404 }) };
  const params = await context.params;
  if (!STUDIO_KINDS.includes(params.kind as StudioKind)) return { response: NextResponse.json({ error: "Unknown collection." }, { status: 404 }) };
  return { user, workspace, kind: params.kind as StudioKind, id: params.id };
}

export async function PATCH(request: Request, context: RouteContext) {
  const ready = await contextFor(context);
  if ("response" in ready) return ready.response;
  const body = await readStudioBody(request);
  if (!body) return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  const result = await updateStudioItem(ready.kind, ready.workspace.id, ready.user.id, ready.workspace.timezone, ready.id, body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ item: result.item });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ready = await contextFor(context);
  if ("response" in ready) return ready.response;
  const result = await deleteStudioItem(ready.kind, ready.workspace.id, ready.user.id, ready.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
