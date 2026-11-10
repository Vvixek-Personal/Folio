import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { driveConnections } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { decryptDriveToken } from "@/lib/drive-crypto";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const [connection] = await db.select({ email: driveConnections.email, refreshTokenEncrypted: driveConnections.refreshTokenEncrypted }).from(driveConnections).where(eq(driveConnections.userId, user.id)).limit(1);
  if (!connection) return NextResponse.json({ connected: false });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  if (!clientId || !secret || !redirectUri) return NextResponse.json({ error: "Drive is not configured." }, { status: 503 });
  try {
    const oauth = new OAuth2Client(clientId, secret, redirectUri);
    oauth.setCredentials({ refresh_token: decryptDriveToken(connection.refreshTokenEncrypted) });
    const { token } = await oauth.getAccessToken();
    if (!token) throw new Error("No access token");
    const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota(limit,usage)", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) throw new Error(`Drive quota request failed (${response.status})`);
    const data = await response.json() as { storageQuota?: { limit?: string; usage?: string } };
    const limit = data.storageQuota?.limit ? Number(data.storageQuota.limit) : null;
    const usage = data.storageQuota?.usage ? Number(data.storageQuota.usage) : null;
    const free = limit !== null && usage !== null ? Math.max(0, limit - usage) : null;
    return NextResponse.json({ connected: true, email: connection.email, limit, usage, free });
  } catch {
    return NextResponse.json({ connected: true, email: connection.email, needsReconnect: true, error: "Reconnect Drive to approve storage access." });
  }
}
