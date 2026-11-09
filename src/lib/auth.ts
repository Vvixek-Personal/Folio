import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "folio_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 30;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
  });
  return token;
}

export async function removeSession(token: string) {
  if (!TOKEN_PATTERN.test(token)) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
}

/**
 * Cookie attributes derived from the real request protocol. SameSite=None is
 * required when the app is embedded in a third-party iframe, and it is only
 * valid together with Secure. Plain-HTTP previews get a non-Secure cookie so
 * the browser does not silently discard it.
 */
export function sessionCookieOptions(request: Request, maxAge = SESSION_SECONDS) {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  let isHttps = forwarded ? forwarded === "https" : false;
  if (!forwarded) {
    try {
      isHttps = new URL(request.url).protocol === "https:";
    } catch {
      isHttps = false;
    }
  }
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge,
  };
}

async function findUserByToken(token: string): Promise<SessionUser | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const [result] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarColor: users.avatarColor,
      isGuest: users.isGuest,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashSessionToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return result ?? null;
}

/** Resolves a user from a raw bearer token (used when cookies are blocked). */
export async function getSessionUserFromToken(token: string | null | undefined) {
  if (!token) return null;
  return findUserByToken(token);
}

/**
 * Preferred order: HttpOnly cookie, then an Authorization: Bearer token that
 * the client mirrors in localStorage. Both are verified against hashed,
 * expiring server-side sessions.
 */
export async function getSessionUser() {
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookieToken && TOKEN_PATTERN.test(cookieToken)) {
    const user = await findUserByToken(cookieToken);
    if (user) return user;
  }
  const authorization = (await headers()).get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return findUserByToken(authorization.slice(7).trim());
  }
  return null;
}

/** The raw token for the current request, if any (used for sign-out revocation). */
export async function getRequestSessionToken() {
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookieToken && TOKEN_PATTERN.test(cookieToken)) return cookieToken;
  const authorization = (await headers()).get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (TOKEN_PATTERN.test(token)) return token;
  }
  return null;
}
