import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
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
  try {
    const rows = await db.select({ id: alkaneDocuments.id, title: alkaneDocuments.title, updatedAt: alkaneDocuments.updatedAt })
      .from(alkaneDocuments).where(eq(alkaneDocuments.workspaceId, workspace.id)).orderBy(desc(alkaneDocuments.updatedAt));
    return NextResponse.json({ documents: rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() })) });
  } catch (reason) {
    if (reason && typeof reason === "object" && "code" in reason && reason.code === "42P01") {
      return NextResponse.json({ error: "Alkane storage is not set up yet. Apply drizzle/0004_alkane_documents.sql to the Folio database." }, { status: 503 });
    }
    throw reason;
  }
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
  const sourceId = typeof model.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(model.id) ? model.id : randomUUID();
  const normalizedDocument = { ...model, id: sourceId };
  const encoded = JSON.stringify(normalizedDocument);
  if (new TextEncoder().encode(encoded).byteLength > MAX_DOCUMENT_BYTES) return NextResponse.json({ error: "This diagram is too large to save to Folio (1.5 MB limit)." }, { status: 413 });
  const requestedTitle = typeof input.title === "string" ? input.title.trim() : "";
  const modelTitle = typeof model.title === "string" ? model.title.trim() : "";
  const title = (requestedTitle || modelTitle || "Untitled Alkane board").slice(0, 160);
  const now = new Date();
  try {
    const [saved] = await db.insert(alkaneDocuments)
      .values({ workspaceId: workspace.id, createdBy: user.id, title, sourceId, document: encoded })
      .onConflictDoUpdate({
        target: [alkaneDocuments.workspaceId, alkaneDocuments.sourceId],
        set: { title, document: encoded, updatedAt: now },
      })
      .returning({ id: alkaneDocuments.id, title: alkaneDocuments.title, updatedAt: alkaneDocuments.updatedAt });
    recordActivity({ workspaceId: workspace.id, actorId: user.id, type: "alkane_document_saved", targetType: "alkane_document", targetId: saved.id, summary: saved.title });
    return NextResponse.json({ document: { ...saved, updatedAt: saved.updatedAt.toISOString() } }, { status: 201 });
  } catch (reason) {
    if (reason && typeof reason === "object" && "code" in reason && reason.code === "42P01") {
      return NextResponse.json({ error: "Alkane storage is not set up yet. Apply drizzle/0004_alkane_documents.sql to the Folio database." }, { status: 503 });
    }
    throw reason;
  }
}
