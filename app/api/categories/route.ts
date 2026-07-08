import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: { name?: unknown; color?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  const color = typeof body.color === "string" && COLOR_RE.test(body.color) ? body.color : null;
  if (!name || !color) {
    return NextResponse.json({ error: "Name und Farbe erforderlich." }, { status: 400 });
  }

  const sql = db();
  try {
    const rows = (await sql`
      insert into categories (user_id, name, color, position)
      values (
        ${userId}, ${name}, ${color},
        (select coalesce(max(position), -1) + 1 from categories where user_id = ${userId})
      )
      returning id, name, color, position, archived
    `) as { id: string; name: string; color: string; position: number; archived: boolean }[];
    return NextResponse.json({ category: rows[0] });
  } catch (e) {
    if (e instanceof Error && e.message.includes("categories_user_id_name_key")) {
      return NextResponse.json({ error: "Diese Kategorie gibt es schon." }, { status: 409 });
    }
    throw e;
  }
}
