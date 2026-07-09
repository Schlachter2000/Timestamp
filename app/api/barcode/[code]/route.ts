import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";
import { offByBarcode } from "@/lib/server/off";

/**
 * Barcode-Lookup: erst der eigene Lebensmittel-Cache, dann Open Food Facts.
 * Gespeichert wird das Produkt erst, wenn der Nutzer es tatsächlich loggt.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { code } = await params;
  if (!/^\d{6,14}$/.test(code)) {
    return NextResponse.json({ error: "Ungültiger Barcode." }, { status: 400 });
  }

  const cached = (await db()`
    select id, barcode, name, brand, base_unit as "baseUnit", kcal,
           protein_g as "proteinG", carbs_g as "carbsG", fat_g as "fatG",
           fiber_g as "fiberG", sugar_g as "sugarG", satfat_g as "satfatG",
           salt_g as "saltG", serving_g as "servingG", source, favorite
    from foods where user_id = ${userId} and barcode = ${code}
    order by updated_at desc limit 1
  `) as object[];
  if (cached.length > 0) {
    return NextResponse.json({ found: true, cached: true, food: cached[0] });
  }

  try {
    const food = await offByBarcode(code);
    if (!food) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, cached: false, food });
  } catch {
    return NextResponse.json({ error: "Open Food Facts nicht erreichbar." }, { status: 502 });
  }
}
