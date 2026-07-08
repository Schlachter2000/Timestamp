import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Unbekannte Kategorie." }, { status: 404 });
  }

  let body: { name?: unknown; color?: unknown; archived?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const name = typeof body.name === "string" && body.name.trim() !== "" ? body.name.trim().slice(0, 40) : null;
  const color = typeof body.color === "string" && COLOR_RE.test(body.color) ? body.color : null;
  const archived = typeof body.archived === "boolean" ? body.archived : null;

  const rows = (await db()`
    update categories set
      name = coalesce(${name}, name),
      color = coalesce(${color}, color),
      archived = coalesce(${archived}, archived)
    where id = ${id} and user_id = ${userId}
    returning id
  `) as unknown[];

  if (rows.length === 0) {
    return NextResponse.json({ error: "Unbekannte Kategorie." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
