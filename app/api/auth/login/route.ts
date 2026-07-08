import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { setSessionCookie, verifyPassword } from "@/lib/server/auth";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const sql = db();
  const users = (await sql`
    select id, password_hash from users where email = ${email}
  `) as { id: string; password_hash: string }[];

  if (users.length === 0 || !verifyPassword(password, users[0].password_hash)) {
    return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
  }

  await setSessionCookie(users[0].id);
  return NextResponse.json({ ok: true });
}
