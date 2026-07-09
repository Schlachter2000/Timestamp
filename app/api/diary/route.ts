import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";
import { day, num, str, uuid } from "@/lib/server/validate";

const MEALS = ["fruehstueck", "mittag", "abend", "snack"];

/** Tagebucheintrag anlegen/aktualisieren (idempotent per Client-UUID). */
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
  const meal = typeof body.meal === "string" && MEALS.includes(body.meal) ? body.meal : null;
  const name = str(body.name, 200);
  const qtyG = num(body.qtyG, 0.1, 10000);
  if (!id || !entryDay || !meal || !name || qtyG === null) {
    return NextResponse.json({ error: "Ungültiger Eintrag." }, { status: 400 });
  }

  const foodId = uuid(body.foodId);
  const n = (v: unknown) => num(v, 0, 50000, 0)!;

  await db()`
    insert into diary_entries (
      id, user_id, day, meal, food_id, name, qty_g,
      kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, satfat_g, updated_at
    ) values (
      ${id}, ${userId}, ${entryDay}, ${meal}, ${foodId}, ${name}, ${qtyG},
      ${n(body.kcal)}, ${n(body.proteinG)}, ${n(body.carbsG)}, ${n(body.fatG)},
      ${n(body.fiberG)}, ${n(body.sugarG)}, ${n(body.satfatG)}, now()
    )
    on conflict (id) do update set
      day = excluded.day,
      meal = excluded.meal,
      food_id = excluded.food_id,
      name = excluded.name,
      qty_g = excluded.qty_g,
      kcal = excluded.kcal,
      protein_g = excluded.protein_g,
      carbs_g = excluded.carbs_g,
      fat_g = excluded.fat_g,
      fiber_g = excluded.fiber_g,
      sugar_g = excluded.sugar_g,
      satfat_g = excluded.satfat_g,
      updated_at = now()
    where diary_entries.user_id = ${userId}
  `;
  return NextResponse.json({ ok: true });
}

/** Tagebucheintrag löschen (?id=…). */
export async function DELETE(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const id = uuid(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });

  await db()`delete from diary_entries where id = ${id} and user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}
