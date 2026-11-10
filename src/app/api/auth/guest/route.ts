import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import {
  createSession,
  getSessionUser,
  hashPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { isEmail, rawString, readJsonBody, textField } from "@/lib/validate";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import { seedStarterWorkspace } from "@/lib/seed";

// A guest is an isolated, anonymous account with a non-guessable internal
// identity. No password is ever exposed, and no demo records are created.
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  }
  if (await getSessionUser()) {
    return NextResponse.json({ error: "You already have an active workspace." }, { status: 409 });
  }

  const uniqueId = randomBytes(24).toString("hex");
  const { user, workspaceId } = await db.transaction(async (tx) => {
    const [account] = await tx.insert(users).values({
      name: "Guest",
      email: `${uniqueId}@guest.folio.invalid`,
      passwordHash: hashPassword(randomBytes(32).toString("hex")),
      avatarColor: "#dfc6a4",
      isGuest: true,
    }).returning({ id: users.id, name: users.name, avatarColor: users.avatarColor, isGuest: users.isGuest });
    const [workspace] = await tx.insert(workspaces).values({
      name: "My workspace",
      ownerId: account.id,
    }).returning({ id: workspaces.id });
    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: account.id, role: "owner" });
    return { user: account, workspaceId: workspace.id };
  });

  await seedStarterWorkspace(workspaceId, user.id, "friend").catch((error) => console.error("Guest starter seed failed", error));
  const token = await createSession(user.id);
  const response = NextResponse.json({ user, token, workspaceId }, { status: 201 });
  const options = sessionCookieOptions(request);
  response.cookies.set(SESSION_COOKIE, token, options);
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, options);
  return response;
}

// Convert the current guest in place. Workspace, pages and tasks keep the same
// owner and IDs; no data is copied between tenants.
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || !user.isGuest) return NextResponse.json({ error: "An active guest session is required." }, { status: 401 });
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  }
  const name = textField(body, "name", 60) ?? "";
  const email = (textField(body, "email", 160) ?? "").toLowerCase();
  const password = rawString(body, "password") ?? "";
  if (name.length < 2) return NextResponse.json({ error: "Add your name to save your workspace." }, { status: 400 });
  if (!isEmail(email) || email.endsWith("@guest.folio.invalid") || password.length < 8 || password.length > 128 || !password.trim()) {
    return NextResponse.json({ error: "Enter a valid email and a password of at least 8 characters." }, { status: 400 });
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  try {
    const [account] = await db.update(users)
      .set({ name, email, passwordHash: hashPassword(password), isGuest: false })
      .where(eq(users.id, user.id))
      .returning({ id: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor, isGuest: users.isGuest });
    if (!account) return NextResponse.json({ error: "This guest workspace could not be saved." }, { status: 409 });
    return NextResponse.json({ user: account });
  } catch (error) {
    const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : error;
    const code = typeof cause === "object" && cause !== null && "code" in cause ? cause.code : undefined;
    if (code === "23505") return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    throw error;
  }
}
