import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";
import { day, num } from "@/lib/server/validate";

/** Gewicht für einen Tag setzen (eine Messung pro Tag). */
export async function PUT(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const entryDay = day(body.day);
  const weightKg = num(body.weightKg, 30, 300);
  if (!entryDay || weightKg === null) {
    return NextResponse.json({ error: "Ungültiges Gewicht." }, { status: 400 });
  }

  await db()`
    insert into weights (user_id, day, weight_kg, updated_at)
    values (${userId}, ${entryDay}, ${weightKg}, now())
    on conflict (user_id, day) do update set weight_kg = excluded.weight_kg, updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}

/** Messung eines Tages löschen (?day=YYYY-MM-DD). */
export async function DELETE(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const entryDay = day(new URL(request.url).searchParams.get("day"));
  if (!entryDay) return NextResponse.json({ error: "Ungültiger Tag." }, { status: 400 });

  await db()`delete from weights where user_id = ${userId} and day = ${entryDay}`;
  return NextResponse.json({ ok: true });
}
