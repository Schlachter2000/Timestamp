import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";
import { day, num, str, uuid } from "@/lib/server/validate";

/** Training/Aktivität anlegen/aktualisieren (idempotent per Client-UUID). */
export async function PUT(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const id = uuid(body.id);
  const entryDay = day(body.day);
  const kind = str(body.kind, 40);
  const durationMin = num(body.durationMin, 1, 1440);
  if (!id || !entryDay || !kind || durationMin === null) {
    return NextResponse.json({ error: "Ungültiges Training." }, { status: 400 });
  }

  await db()`
    insert into workouts (id, user_id, day, kind, title, duration_min, rpe, kcal, notes, updated_at)
    values (
      ${id}, ${userId}, ${entryDay}, ${kind}, ${str(body.title, 200)}, ${durationMin},
      ${num(body.rpe, 1, 10, null)}, ${num(body.kcal, 0, 10000, 0)!}, ${str(body.notes, 1000)}, now()
    )
    on conflict (id) do update set
      day = excluded.day,
      kind = excluded.kind,
      title = excluded.title,
      duration_min = excluded.duration_min,
      rpe = excluded.rpe,
      kcal = excluded.kcal,
      notes = excluded.notes,
      updated_at = now()
    where workouts.user_id = ${userId}
  `;
  return NextResponse.json({ ok: true });
}

/** Training löschen (?id=…). */
export async function DELETE(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const id = uuid(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });

  await db()`delete from workouts where id = ${id} and user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}
