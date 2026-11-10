import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createStudioItem, readStudioBody } from "@/lib/studio";
import { STUDIO_KINDS, type StudioKind } from "@/lib/studio-types";
import { getWorkspaceForUser } from "@/lib/workspace";

type RouteContext = { params: Promise<{ kind: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to add something." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const { kind } = await context.params;
  if (!STUDIO_KINDS.includes(kind as StudioKind)) return NextResponse.json({ error: "Unknown collection." }, { status: 404 });
  const body = await readStudioBody(request);
  if (!body) return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  const result = await createStudioItem(kind as StudioKind, workspace.id, user.id, workspace.timezone, body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ item: result.item }, { status: 201 });
}
