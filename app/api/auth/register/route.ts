import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { hashPassword, setSessionCookie } from "@/lib/server/auth";

/** Registrierung ist offen, bis das erste Konto existiert (Single-User-App). */
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email.includes("@") || password.length < 8) {
    return NextResponse.json(
      { error: "E-Mail und ein Passwort mit mindestens 8 Zeichen sind erforderlich." },
      { status: 400 }
    );
  }

  const sql = db();
  const existing = (await sql`select count(*)::int as count from users`) as { count: number }[];
  if (existing[0].count > 0) {
    return NextResponse.json({ error: "Die Registrierung ist geschlossen." }, { status: 403 });
  }

  const rows = (await sql`
    insert into users (email, password_hash)
    values (${email}, ${hashPassword(password)})
    returning id
  `) as { id: string }[];
  const userId = rows[0].id;
  await sql`insert into profiles (user_id) values (${userId}) on conflict do nothing`;

  await setSessionCookie(userId);
  return NextResponse.json({ ok: true });
}
