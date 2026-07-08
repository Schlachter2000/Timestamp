import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

interface ImportCategory {
  name: string;
  color: string;
  archived: boolean;
}

interface ImportEntry {
  day: string;
  slot: number;
  category: string | null; // Kategoriename aus dem lokalen Stand
  note: string | null;
}

/**
 * Einmaliger Import des Phase-1-Stands aus localStorage. Läuft nur, solange
 * das Konto noch keine Einträge hat – ein zweiter Aufruf ist ein No-op.
 */
export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: { categories?: ImportCategory[]; entries?: ImportEntry[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const sql = db();
  const existing = (await sql`
    select count(*)::int as count from entries where user_id = ${userId}
  `) as { count: number }[];
  if (existing[0].count > 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped: "Konto hat bereits Einträge." });
  }

  // Kategorien nach Name abgleichen, fehlende anlegen.
  const categories = (Array.isArray(body.categories) ? body.categories : []).filter(
    (c) => typeof c?.name === "string" && c.name.trim() !== "" && COLOR_RE.test(c?.color ?? "")
  );
  const rows = (await sql`
    select id, name from categories where user_id = ${userId}
  `) as { id: string; name: string }[];
  const byName = new Map(rows.map((r) => [r.name, r.id]));

  for (const cat of categories) {
    const name = cat.name.trim().slice(0, 40);
    if (byName.has(name)) continue;
    const inserted = (await sql`
      insert into categories (user_id, name, color, position, archived)
      values (
        ${userId}, ${name}, ${cat.color},
        (select coalesce(max(position), -1) + 1 from categories where user_id = ${userId}),
        ${cat.archived === true}
      )
      returning id
    `) as { id: string }[];
    byName.set(name, inserted[0].id);
  }

  let imported = 0;
  for (const entry of Array.isArray(body.entries) ? body.entries : []) {
    if (typeof entry?.day !== "string" || !DAY_RE.test(entry.day)) continue;
    if (!Number.isInteger(entry.slot) || entry.slot < 0 || entry.slot > 95) continue;
    const categoryId = entry.category ? (byName.get(entry.category) ?? null) : null;
    const note =
      typeof entry.note === "string" && entry.note.trim() !== "" ? entry.note.trim().slice(0, 500) : null;
    if (!categoryId && !note) continue;
    await sql`
      insert into entries (user_id, day, slot, category_id, note)
      values (${userId}, ${entry.day}, ${entry.slot}, ${categoryId}, ${note})
      on conflict (user_id, day, slot) do nothing
    `;
    imported++;
  }

  return NextResponse.json({ ok: true, imported });
}
