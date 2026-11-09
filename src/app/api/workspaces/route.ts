import { NextResponse } from "next/server";
import { getSessionUser, SESSION_SECONDS } from "@/lib/auth";
import { readJsonBody, textField } from "@/lib/validate";
import { ACTIVE_WORKSPACE_COOKIE, getWorkspaceForUser, getWorkspacesForUser } from "@/lib/workspace";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to view workspaces." }, { status: 401 });
  const [workspaces, active] = await Promise.all([getWorkspacesForUser(user.id), getWorkspaceForUser(user.id)]);
  return NextResponse.json({ workspaces, activeId: active?.id ?? null });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to switch workspaces." }, { status: 401 });
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  const workspaceId = textField(body, "workspaceId", 36) ?? "";
  const accessible = await getWorkspacesForUser(user.id);
  if (!accessible.some((workspace) => workspace.id === workspaceId)) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS,
  });
  return response;
}
