import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listStudio } from "@/lib/studio";
import { getWorkspaceForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to open the studio." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  return NextResponse.json(await listStudio(workspace.id));
}
