import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { hashPassword, setSessionCookie } from "@/lib/server/auth";

const DEFAULT_CATEGORIES: [string, string][] = [
  ["Arbeit", "#2E8A5C"],
  ["Meeting", "#B13A4B"],
  ["Essen", "#B0622D"],
  ["Pause", "#C2497B"],
  ["Sport", "#2B7BBF"],
  ["Schlaf", "#7A55C2"],
];

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Bitte eine gültige E-Mail-Adresse angeben." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Das Passwort braucht mindestens 8 Zeichen." }, { status: 400 });
  }

  const sql = db();
  const existing = (await sql`select count(*)::int as count from users`) as { count: number }[];
  if (existing[0].count > 0) {
    return NextResponse.json(
      { error: "Die Registrierung ist deaktiviert – es existiert bereits ein Konto." },
      { status: 403 }
    );
  }

  const passwordHash = hashPassword(password);
  const users = (await sql`
    insert into users (email, password_hash) values (${email}, ${passwordHash})
    returning id
  `) as { id: string }[];
  const userId = users[0].id;

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const [name, color] = DEFAULT_CATEGORIES[i];
    await sql`insert into categories (user_id, name, color, position) values (${userId}, ${name}, ${color}, ${i})`;
  }
  await sql`insert into user_settings (user_id) values (${userId})`;

  await setSessionCookie(userId);
  return NextResponse.json({ ok: true });
}
