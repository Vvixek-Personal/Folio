import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { driveConnections } from "@/db/schema";
import { getSessionUser, sessionCookieOptions } from "@/lib/auth";
import { encryptDriveToken } from "@/lib/drive-crypto";
import { getWorkspaceForUser } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";

const STATE = "folio_drive_state";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await getSessionUser();
  const expected = request.headers.get("cookie")?.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${STATE}=`))?.slice(STATE.length + 1);
  const state = url.searchParams.get("state");
  const fail = (code: string) => NextResponse.redirect(new URL(`/?connectorError=${encodeURIComponent(code)}`, request.url));
  if (!user || !state || !expected || state !== expected) return fail("drive_state_invalid");
  if (url.searchParams.get("error")) return fail("drive_cancelled");
  const code = url.searchParams.get("code");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  if (!code || !clientId || !secret || !redirectUri) return fail("drive_not_configured");
  try {
    const oauth = new OAuth2Client(clientId, secret, redirectUri);
    const { tokens } = await oauth.getToken(code);
    if (!tokens.id_token || !tokens.refresh_token) throw new Error("Drive authorization did not return a refresh token.");
    const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email) throw new Error("Drive account identity unavailable.");
    const encrypted = encryptDriveToken(tokens.refresh_token);
    await db.insert(driveConnections).values({ userId: user.id, googleAccountId: profile.sub, email: profile.email.toLowerCase(), refreshTokenEncrypted: encrypted, updatedAt: new Date() }).onConflictDoUpdate({ target: driveConnections.userId, set: { googleAccountId: profile.sub, email: profile.email.toLowerCase(), refreshTokenEncrypted: encrypted, updatedAt: new Date() } });
    const workspace = await getWorkspaceForUser(user.id);
    if (workspace) await recordActivity({ workspaceId: workspace.id, actorId: user.id, type: "drive_connected", summary: profile.email.toLowerCase(), detail: "Google Drive connected" });
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(STATE, "", { ...sessionCookieOptions(request), maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Drive connector failed:", error);
    return fail("drive_connection_failed");
  }
}
