import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser, sessionCookieOptions } from "@/lib/auth";

const STATE = "folio_drive_state";
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/?authError=signin_required", request.url));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  if (!clientId || !redirectUri) return NextResponse.redirect(new URL("/?authError=drive_not_configured", request.url));
  const state = randomBytes(32).toString("hex");
  const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  target.searchParams.set("client_id", clientId);
  target.searchParams.set("redirect_uri", redirectUri);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/drive.file");
  target.searchParams.set("access_type", "offline");
  target.searchParams.set("prompt", "consent select_account");
  target.searchParams.set("state", state);
  const response = NextResponse.redirect(target);
  response.cookies.set(STATE, state, { ...sessionCookieOptions(request), httpOnly: true, maxAge: 600 });
  return response;
}
