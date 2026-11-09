import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, workspaceInvitations, workspaceMembers, workspaces } from "@/db/schema";
import { createSession, hashPassword, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";

const STATE_COOKIE = "folio_google_oauth_state";
const INVITE_COOKIE = "folio_google_oauth_invite";
const avatarColors = ["#d8d3ff", "#f2c6ae", "#d5e9d7", "#f6dfad", "#d6e7f3"];

function redirectWithError(request: Request, code: string) {
  return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(code)}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1);

  const clearState = (response: NextResponse) => {
    const options = { ...sessionCookieOptions(request, 0), sameSite: "lax" as const };
    response.cookies.set(STATE_COOKIE, "", options);
    response.cookies.set(INVITE_COOKIE, "", options);
    return response;
  };

  if (!state || !expectedState || state.length > 256 || state !== expectedState) {
    return clearState(redirectWithError(request, "google_state_invalid"));
  }
  if (url.searchParams.get("error")) {
    return clearState(redirectWithError(request, "google_cancelled"));
  }
  if (!code) return clearState(redirectWithError(request, "google_missing_code"));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return clearState(redirectWithError(request, "google_not_configured"));
  }

  try {
    const oauth = new OAuth2Client(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth.getToken(code);
    if (!tokens.id_token) throw new Error("Google did not return an ID token.");
    const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      throw new Error("Google account does not have a verified email address.");
    }

    const email = profile.email.toLowerCase();
    const name = (profile.name || profile.given_name || email.split("@")[0]).slice(0, 60);
    const inviteToken = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${INVITE_COOKIE}=`))?.slice(INVITE_COOKIE.length + 1) ?? "";
    let invitation: typeof workspaceInvitations.$inferSelect | undefined;

    if (inviteToken) {
      const { createHash } = await import("node:crypto");
      const digest = createHash("sha256").update(inviteToken).digest("hex");
      const [found] = await db.select().from(workspaceInvitations).where(
        and(
          eq(workspaceInvitations.tokenHash, digest),
          eq(workspaceInvitations.email, email),
          isNull(workspaceInvitations.acceptedAt),
          gt(workspaceInvitations.expiresAt, new Date()),
        ),
      ).limit(1);
      if (!found) return clearState(redirectWithError(request, "invitation_invalid"));
      invitation = found;
    }

    const result = await db.transaction(async (tx) => {
      let [account] = await tx.select().from(users).where(eq(users.googleId, profile.sub)).limit(1);

      if (!account) {
        const [emailAccount] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
        if (emailAccount) {
          // Link only after Google's ID token confirms this exact email is verified.
          [account] = await tx.update(users).set({ googleId: profile.sub }).where(eq(users.id, emailAccount.id)).returning();
        } else {
          const [created] = await tx.insert(users).values({
            name,
            email,
            googleId: profile.sub,
            // The account authenticates with Google; this random password is never disclosed.
            passwordHash: hashPassword(randomBytes(48).toString("hex")),
            avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)],
          }).returning();
          account = created;
        }
      }
      if (!account) throw new Error("Could not resolve the Google account.");

      let workspaceId: string | undefined;
      if (invitation) {
        await tx.insert(workspaceMembers).values({
          workspaceId: invitation.workspaceId,
          userId: account.id,
          role: invitation.role,
        }).onConflictDoNothing();
        await tx.update(workspaceInvitations).set({ acceptedAt: new Date() }).where(eq(workspaceInvitations.id, invitation.id));
        workspaceId = invitation.workspaceId;
      } else {
        const [membership] = await tx.select({ workspaceId: workspaceMembers.workspaceId })
          .from(workspaceMembers).where(eq(workspaceMembers.userId, account.id)).limit(1);
        if (membership) workspaceId = membership.workspaceId;
        else {
          const [workspace] = await tx.insert(workspaces).values({
            name: `${account.name.split(" ")[0]}’s workspace`,
            ownerId: account.id,
          }).returning({ id: workspaces.id });
          await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: account.id, role: "owner" });
          workspaceId = workspace.id;
        }
      }
      return { account, workspaceId };
    });

    if (invitation) {
      recordActivity({ workspaceId: invitation.workspaceId, actorId: result.account.id, type: "member_joined", targetType: "member" });
    }

    const session = await createSession(result.account.id);
    const response = NextResponse.redirect(new URL("/", request.url));
    const options = sessionCookieOptions(request);
    response.cookies.set(SESSION_COOKIE, session, options);
    if (result.workspaceId) response.cookies.set(ACTIVE_WORKSPACE_COOKIE, result.workspaceId, options);
    response.cookies.set(STATE_COOKIE, "", { ...options, maxAge: 0, sameSite: "lax" });
    response.cookies.set(INVITE_COOKIE, "", { ...options, maxAge: 0, sameSite: "lax" });
    // The app already supports this one-time token fallback when preview cookies are blocked.
    const destination = new URL("/", request.url);
    destination.searchParams.set("session", session);
    response.headers.set("location", destination.toString());
    return response;
  } catch (error) {
    console.error("Google OAuth sign-in failed:", error);
    return clearState(redirectWithError(request, "google_signin_failed"));
  }
}
