import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const STATE_COOKIE = "folio_google_oauth_state";
const INVITE_COOKIE = "folio_google_oauth_invite";

function cookieOptions(request: Request) {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const secure = forwarded ? forwarded === "https" : new URL(request.url).protocol === "https:";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/?authError=google_not_configured", request.url));
  }

  const state = randomBytes(32).toString("hex");
  const invite = new URL(request.url).searchParams.get("invite");

  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizationUrl);
  const options = cookieOptions(request);
  response.cookies.set(STATE_COOKIE, state, options);
  if (invite && /^[a-f0-9]{32,128}$/i.test(invite)) {
    response.cookies.set(INVITE_COOKIE, invite, options);
  } else {
    response.cookies.set(INVITE_COOKIE, "", { ...options, maxAge: 0 });
  }
  return response;
}
