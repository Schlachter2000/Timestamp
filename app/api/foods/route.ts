import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";
import { num, str, uuid } from "@/lib/server/validate";

/** Lebensmittel anlegen/aktualisieren (idempotent per Client-UUID). */
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
  const name = str(body.name, 200);
  if (!id || !name) return NextResponse.json({ error: "Ungültiges Lebensmittel." }, { status: 400 });

  const barcode = str(body.barcode, 64);
  const brand = str(body.brand, 200);
  const baseUnit = body.baseUnit === "ml" ? "ml" : "g";
  const source = body.source === "off" ? "off" : "manual";
  const favorite = body.favorite === true;
  const n = (v: unknown) => num(v, 0, 10000, 0)!;

  await db()`
    insert into foods (
      id, user_id, barcode, name, brand, base_unit, kcal, protein_g, carbs_g, fat_g,
      fiber_g, sugar_g, satfat_g, salt_g, serving_g, source, favorite, updated_at
    ) values (
      ${id}, ${userId}, ${barcode}, ${name}, ${brand}, ${baseUnit},
      ${n(body.kcal)}, ${n(body.proteinG)}, ${n(body.carbsG)}, ${n(body.fatG)},
      ${n(body.fiberG)}, ${n(body.sugarG)}, ${n(body.satfatG)}, ${n(body.saltG)},
      ${num(body.servingG, 0.1, 5000, null)}, ${source}, ${favorite}, now()
    )
    on conflict (id) do update set
      barcode = excluded.barcode,
      name = excluded.name,
      brand = excluded.brand,
      base_unit = excluded.base_unit,
      kcal = excluded.kcal,
      protein_g = excluded.protein_g,
      carbs_g = excluded.carbs_g,
      fat_g = excluded.fat_g,
      fiber_g = excluded.fiber_g,
      sugar_g = excluded.sugar_g,
      satfat_g = excluded.satfat_g,
      salt_g = excluded.salt_g,
      serving_g = excluded.serving_g,
      source = excluded.source,
      favorite = excluded.favorite,
      updated_at = now()
    where foods.user_id = ${userId}
  `;
  return NextResponse.json({ ok: true });
}

/** Lebensmittel löschen (?id=…). Tagebucheinträge behalten ihre Kopie der Werte. */
export async function DELETE(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const id = uuid(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });

  await db()`delete from foods where id = ${id} and user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}
