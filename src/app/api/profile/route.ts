import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { readJsonBody, textField } from "@/lib/validate";

const COLORS = ["#d8d3ff", "#f2c6ae", "#d5e9d7", "#f6dfad", "#d6e7f3", "#e7d4c4", "#c9ddd4"];

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Malformed request data." }, { status: 400 });
  const name = textField(body, "name", 60);
  const avatarColor = textField(body, "avatarColor", 7);
  if (name !== undefined && name.length < 2) return NextResponse.json({ error: "Add a name of at least 2 characters." }, { status: 400 });
  if (avatarColor !== undefined && !COLORS.includes(avatarColor)) return NextResponse.json({ error: "Choose one of the studio colours." }, { status: 400 });
  const values: { name?: string; avatarColor?: string } = {};
  if (name) values.name = name;
  if (avatarColor) values.avatarColor = avatarColor;
  if (!Object.keys(values).length) return NextResponse.json({ user });
  const [updated] = await db.update(users).set(values).where(eq(users.id, user.id)).returning({
    id: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor, isGuest: users.isGuest, googleId: users.googleId,
  });
  return NextResponse.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatarColor: updated.avatarColor,
      isGuest: updated.isGuest,
      signedInWith: updated.isGuest ? "guest" : updated.googleId ? "google" : "email",
    },
  });
}
