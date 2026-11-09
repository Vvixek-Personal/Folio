import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isSafePageContent } from "@/lib/page-content";
import { serializePage } from "@/lib/serialize";
import { booleanField, enumField, rawString, readJsonBody, textField } from "@/lib/validate";
import { getWorkspaceForUser } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";


const COVERS = ["sage", "clay", "sand", "sky", "olive", "none"];
const MAX_CONTENT = 100000;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to access your pages." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const rows = await db.select().from(pages).where(eq(pages.workspaceId, workspace.id)).orderBy(desc(pages.updatedAt));
  return NextResponse.json({ pages: rows.map(serializePage) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a page." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  }

  const title = textField(body, "title", 160) ?? "";
  const icon = textField(body, "icon", 12) || "file";
  const cover = enumField(body, "cover", COVERS) ?? "sage";
  const content = (rawString(body, "content") ?? "").trim();
  const isFavorite = booleanField(body, "isFavorite") === true ? "true" : "false";
  if (!title) return NextResponse.json({ error: "Give your page a title first." }, { status: 400 });
  if (content.length > MAX_CONTENT) return NextResponse.json({ error: "This page is too long to save." }, { status: 400 });
  if (!isSafePageContent(content)) return NextResponse.json({ error: "The page contains unsupported formatting or an unsafe link." }, { status: 400 });

  const [page] = await db.insert(pages).values({ workspaceId: workspace.id, createdBy: user.id, title, icon, cover, content, isFavorite }).returning();
  recordActivity({ workspaceId: workspace.id, actorId: user.id, type: "page_created", targetType: "page", targetId: page.id, summary: page.title });
  return NextResponse.json({ page: serializePage(page) }, { status: 201 });
}
