import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Eintrag (oder mehrere aufeinanderfolgende Slots) anlegen/überschreiben. */
export async function PUT(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: { day?: unknown; slot?: unknown; categoryId?: unknown; note?: unknown; slotCount?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const day = typeof body.day === "string" && DAY_RE.test(body.day) ? body.day : null;
  const slot = typeof body.slot === "number" && Number.isInteger(body.slot) ? body.slot : NaN;
  const slotCount =
    typeof body.slotCount === "number" && Number.isInteger(body.slotCount) ? body.slotCount : 1;
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : null;
  const note =
    typeof body.note === "string" && body.note.trim() !== "" ? body.note.trim().slice(0, 500) : null;

  if (!day || slot < 0 || slot > 95 || slotCount < 1 || slot + slotCount > 96) {
    return NextResponse.json({ error: "Ungültiger Slot." }, { status: 400 });
  }
  if (!categoryId && !note) {
    return NextResponse.json({ error: "Kategorie oder Notiz erforderlich." }, { status: 400 });
  }

  const sql = db();
  if (categoryId) {
    const owned = (await sql`
      select 1 from categories where id = ${categoryId} and user_id = ${userId}
    `) as unknown[];
    if (owned.length === 0) {
      return NextResponse.json({ error: "Unbekannte Kategorie." }, { status: 400 });
    }
  }

  for (let s = slot; s < slot + slotCount; s++) {
    await sql`
      insert into entries (user_id, day, slot, category_id, note)
      values (${userId}, ${day}, ${s}, ${categoryId}, ${note})
      on conflict (user_id, day, slot)
      do update set category_id = ${categoryId}, note = ${note}, updated_at = now()
    `;
  }
  return NextResponse.json({ ok: true });
}

/** Eintrag eines Slots löschen (?day=YYYY-MM-DD&slot=N). */
export async function DELETE(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const day = params.get("day") ?? "";
  const slot = Number(params.get("slot"));
  if (!DAY_RE.test(day) || !Number.isInteger(slot) || slot < 0 || slot > 95) {
    return NextResponse.json({ error: "Ungültiger Slot." }, { status: 400 });
  }

  await db()`delete from entries where user_id = ${userId} and day = ${day} and slot = ${slot}`;
  return NextResponse.json({ ok: true });
}
