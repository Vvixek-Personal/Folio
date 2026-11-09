import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workspaceInvitations, workspaceMembers } from "@/db/schema";
import { getSessionUser, SESSION_SECONDS } from "@/lib/auth";
import { readJsonBody, textField } from "@/lib/validate";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";


export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in with the invited email to join." }, { status: 401 });
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  const token = textField(body, "token", 128) ?? "";
  if (!token) return NextResponse.json({ error: "This invitation is invalid or expired." }, { status: 400 });
  if (user.isGuest) return NextResponse.json({ error: "Sign in with the email that received this invitation." }, { status: 403 });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const joined = await db.transaction(async (tx) => {
    const [invite] = await tx.update(workspaceInvitations).set({ acceptedAt: new Date() })
      .where(and(eq(workspaceInvitations.tokenHash, tokenHash), eq(workspaceInvitations.email, user.email), isNull(workspaceInvitations.acceptedAt), gt(workspaceInvitations.expiresAt, new Date())))
      .returning({ workspaceId: workspaceInvitations.workspaceId, role: workspaceInvitations.role });
    if (!invite) return null;
    await tx.insert(workspaceMembers).values({ workspaceId: invite.workspaceId, userId: user.id, role: invite.role }).onConflictDoNothing();
    return invite;
  });
  if (!joined) return NextResponse.json({ error: "This invitation has expired or was created for a different email." }, { status: 400 });
  recordActivity({ workspaceId: joined.workspaceId, actorId: user.id, type: "member_joined", targetType: "member" });
  const response = NextResponse.json({ ok: true, workspaceId: joined.workspaceId });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, joined.workspaceId, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS,
  });
  return response;
}
