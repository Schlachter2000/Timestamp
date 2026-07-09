import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";
import { num } from "@/lib/server/validate";

/** Profil/Ziele komplett schreiben (der Client schickt immer das ganze Objekt). */
export async function PATCH(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const sex = body.sex === "w" ? "w" : "m";
  const goal =
    typeof body.goal === "string" && ["cut", "recomp", "gain", "maintain"].includes(body.goal)
      ? body.goal
      : "recomp";
  const birthYear = num(body.birthYear, 1900, 2030, 1995)!;
  const heightCm = num(body.heightCm, 100, 250, 180)!;
  const activityLevel = num(body.activityLevel, 1.2, 2.4, 1.4)!;
  const weeklyRatePct = num(body.weeklyRatePct, -1.5, 1.0, -0.25)!;
  const proteinGPerKg = num(body.proteinGPerKg, 1.0, 3.5, 2.2)!;
  const fatGPerKg = num(body.fatGPerKg, 0.5, 2.0, 0.9)!;
  const activityCreditPct = num(body.activityCreditPct, 0, 100, 50)!;
  const kcalOverride = num(body.kcalOverride, 1000, 6000, null);

  await db()`
    insert into profiles (
      user_id, sex, birth_year, height_cm, activity_level, goal, weekly_rate_pct,
      protein_g_per_kg, fat_g_per_kg, activity_credit_pct, kcal_override, updated_at
    ) values (
      ${userId}, ${sex}, ${birthYear}, ${heightCm}, ${activityLevel}, ${goal}, ${weeklyRatePct},
      ${proteinGPerKg}, ${fatGPerKg}, ${activityCreditPct}, ${kcalOverride}, now()
    )
    on conflict (user_id) do update set
      sex = excluded.sex,
      birth_year = excluded.birth_year,
      height_cm = excluded.height_cm,
      activity_level = excluded.activity_level,
      goal = excluded.goal,
      weekly_rate_pct = excluded.weekly_rate_pct,
      protein_g_per_kg = excluded.protein_g_per_kg,
      fat_g_per_kg = excluded.fat_g_per_kg,
      activity_credit_pct = excluded.activity_credit_pct,
      kcal_override = excluded.kcal_override,
      updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}
