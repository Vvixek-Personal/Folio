import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { alkaneDocuments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to open this Alkane document." }, { status: 401 });
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Saved Alkane document not found." }, { status: 404 });
  try {
    const [row] = await db.select().from(alkaneDocuments)
      .where(and(eq(alkaneDocuments.id, id), eq(alkaneDocuments.workspaceId, workspace.id)))
      .limit(1);
    if (!row) return NextResponse.json({ error: "Saved Alkane document not found." }, { status: 404 });

    let document: unknown;
    try { document = JSON.parse(row.document); }
    catch { return NextResponse.json({ error: "This saved diagram could not be read." }, { status: 500 }); }

    return NextResponse.json({ document: { id: row.id, title: row.title, updatedAt: row.updatedAt.toISOString(), data: document } });
  } catch (reason) {
    if (reason && typeof reason === "object" && "code" in reason && reason.code === "42P01") {
      return NextResponse.json({ error: "Alkane storage is not set up yet. Apply drizzle/0004_alkane_documents.sql to the Folio database." }, { status: 503 });
    }
    throw reason;
  }
}
