import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, workspaceInvitations, workspaceMembers, workspaces } from "@/db/schema";
import {
  createSession,
  getRequestSessionToken,
  hashPassword,
  removeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { isEmail, rawString, readJsonBody, stripFields, textField } from "@/lib/validate";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import { recordActivity } from "@/lib/activity";
import { DEMO_EMAIL, ensureDemoStudio, seedStarterWorkspace } from "@/lib/seed";


const avatarColors = ["#d8d3ff", "#f2c6ae", "#d5e9d7", "#f6dfad", "#d6e7f3"];
const PROTECTED_ACCOUNT_FIELDS = ["id", "passwordHash", "avatarColor", "createdAt"] as const;

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Returns the session token in the body as well as the cookie. Embedded
 * previews can block third-party cookies, so the client keeps this opaque
 * token and sends it as a bearer token instead.
 */
function sessionResponse(request: Request, user: SessionUser, token: string, workspaceId?: string) {
  const response = NextResponse.json({ user, token, workspaceId: workspaceId ?? null });
  const options = sessionCookieOptions(request);
  response.cookies.set(SESSION_COOKIE, token, options);
  if (workspaceId) {
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, options);
  }
  return response;
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  }
  stripFields(body, PROTECTED_ACCOUNT_FIELDS);

  if (rawString(body, "mode") === "demo") {
    await ensureDemoStudio();
    const [account] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
    if (!account) return NextResponse.json({ error: "The studio is still getting ready. Try again in a moment." }, { status: 503 });
    const [membership] = await db.select({ id: workspaces.id }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).where(eq(workspaceMembers.userId, account.id)).limit(1);
    const user = { id: account.id, name: account.name, email: account.email, avatarColor: account.avatarColor, isGuest: account.isGuest, signedInWith: "email" as const };
    return sessionResponse(request, user, await createSession(account.id), membership?.id);
  }

  const mode = rawString(body, "mode") === "signup" ? "signup" : "login";
  const email = (textField(body, "email", 160) ?? "").toLowerCase();
  const name = textField(body, "name", 60) ?? "";
  const password = rawString(body, "password") ?? "";
  const inviteToken = textField(body, "inviteToken", 128) ?? "";

  if (!isEmail(email) || email.endsWith("@guest.folio.invalid") || password.length < 8 || password.length > 128 || password.trim().length === 0) {
    return NextResponse.json({ error: "Enter a valid email and a password of at least 8 characters." }, { status: 400 });
  }

  let invitation: typeof workspaceInvitations.$inferSelect | undefined;
  if (inviteToken) {
    const [found] = await db
      .select()
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.tokenHash, tokenDigest(inviteToken)),
          eq(workspaceInvitations.email, email),
          isNull(workspaceInvitations.acceptedAt),
          gt(workspaceInvitations.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!found) {
      return NextResponse.json({ error: "This invitation has expired or was created for a different email." }, { status: 400 });
    }
    invitation = found;
  }

  if (mode === "signup") {
    if (name.length < 2) return NextResponse.json({ error: "Add your name to get started." }, { status: 400 });
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists. Try signing in." }, { status: 409 });
    }

    try {
      const account = await db.transaction(async (tx) => {
        const [newUser] = await tx
          .insert(users)
          .values({
            name,
            email,
            passwordHash: hashPassword(password),
            avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)],
          })
          .returning({ id: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor, isGuest: users.isGuest });

        if (invitation) {
          await tx.insert(workspaceMembers).values({ workspaceId: invitation.workspaceId, userId: newUser.id, role: invitation.role });
          await tx.update(workspaceInvitations).set({ acceptedAt: new Date() }).where(eq(workspaceInvitations.id, invitation.id));
          return { user: newUser, workspaceId: invitation.workspaceId };
        }

        const [workspace] = await tx
          .insert(workspaces)
          .values({ name: `${name.split(" ")[0]}’s workspace`, ownerId: newUser.id })
          .returning({ id: workspaces.id });
        await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: newUser.id, role: "owner" });
        // New workspaces start empty — no sample pages, tasks, or teammates.
        return { user: newUser, workspaceId: workspace.id };
      });
      if (invitation) recordActivity({ workspaceId: invitation.workspaceId, actorId: account.user.id, type: "member_joined", targetType: "member" });
      else await seedStarterWorkspace(account.workspaceId, account.user.id, account.user.name).catch((error) => console.error("Starter seed failed", error));
      return sessionResponse(request, account.user, await createSession(account.user.id), account.workspaceId);
    } catch (error) {
      const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : error;
      const code = typeof cause === "object" && cause !== null && "code" in cause ? cause.code : undefined;
      if (code === "23505") {
        return NextResponse.json({ error: "An account with that email already exists. Try signing in." }, { status: 409 });
      }
      throw error;
    }
  }

  const [account] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return NextResponse.json({ error: "That email and password don’t match. Please try again." }, { status: 401 });
  }

  if (invitation) {
    await db
      .insert(workspaceMembers)
      .values({ workspaceId: invitation.workspaceId, userId: account.id, role: invitation.role })
      .onConflictDoNothing();
    await db.update(workspaceInvitations).set({ acceptedAt: new Date() }).where(eq(workspaceInvitations.id, invitation.id));
  }

  const user = { id: account.id, name: account.name, email: account.email, avatarColor: account.avatarColor, isGuest: account.isGuest };
  if (invitation) recordActivity({ workspaceId: invitation.workspaceId, actorId: account.id, type: "member_joined", targetType: "member" });
  return sessionResponse(request, user, await createSession(account.id), invitation?.workspaceId);
}

export async function DELETE(request: Request) {
  const token = await getRequestSessionToken();
  if (token) await removeSession(token);
  const response = NextResponse.json({ ok: true });
  const options = sessionCookieOptions(request, 0);
  response.cookies.set(SESSION_COOKIE, "", options);
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, "", options);
  return response;
}
