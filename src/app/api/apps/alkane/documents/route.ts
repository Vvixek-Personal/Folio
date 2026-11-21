import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { alkaneDocuments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { getWorkspaceForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";
const MAX_DOCUMENT_BYTES = 1_500_000;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to access saved Alkane documents." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const rows = await db.select({ id: alkaneDocuments.id, title: alkaneDocuments.title, updatedAt: alkaneDocuments.updatedAt })
    .from(alkaneDocuments).where(eq(alkaneDocuments.workspaceId, workspace.id)).orderBy(desc(alkaneDocuments.updatedAt));
  return NextResponse.json({ documents: rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() })) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to save an Alkane document." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Malformed save request." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const document = input.document;
  if (!document || typeof document !== "object" || Array.isArray(document)) return NextResponse.json({ error: "The Alkane document is missing or invalid." }, { status: 400 });
  const model = document as Record<string, unknown>;
  if (model.schemaVersion !== 1 || !Array.isArray(model.boards) || model.boards.length < 1 || model.boards.length > 100 || typeof model.activeBoardId !== "string") {
    return NextResponse.json({ error: "This Alkane document format is not supported." }, { status: 400 });
  }
  const encoded = JSON.stringify(document);
  if (new TextEncoder().encode(encoded).byteLength > MAX_DOCUMENT_BYTES) return NextResponse.json({ error: "This diagram is too large to save to Folio (1.5 MB limit)." }, { status: 413 });
  const requestedTitle = typeof input.title === "string" ? input.title.trim() : "";
  const modelTitle = typeof model.title === "string" ? model.title.trim() : "";
  const title = (requestedTitle || modelTitle || "Untitled Alkane board").slice(0, 160);
  const [saved] = await db.insert(alkaneDocuments).values({ workspaceId: workspace.id, createdBy: user.id, title, document: encoded }).returning({ id: alkaneDocuments.id, title: alkaneDocuments.title, updatedAt: alkaneDocuments.updatedAt });
  recordActivity({ workspaceId: workspace.id, actorId: user.id, type: "alkane_document_saved", targetType: "alkane_document", targetId: saved.id, summary: saved.title });
  return NextResponse.json({ document: { ...saved, updatedAt: saved.updatedAt.toISOString() } }, { status: 201 });
}
