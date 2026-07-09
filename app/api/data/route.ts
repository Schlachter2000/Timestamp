import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";
import { DEFAULT_PROFILE } from "@/lib/types";

/**
 * Kompletter Datenstand für den Client-Store (eine Antwort pro Sync-Tick).
 * Tagebuch/Training/Schritte auf die letzten 400 Tage begrenzt – genug für
 * alle Auswertungen, bleibt aber auch nach Jahren kompakt.
 */
export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const sql = db();
  const [users, profiles, foods, diary, weights, workouts, steps, chat] = await Promise.all([
    sql`select email from users where id = ${userId}`,
    sql`
      select sex, birth_year as "birthYear", height_cm as "heightCm",
             activity_level as "activityLevel", goal, weekly_rate_pct as "weeklyRatePct",
             protein_g_per_kg as "proteinGPerKg", fat_g_per_kg as "fatGPerKg",
             activity_credit_pct as "activityCreditPct", kcal_override as "kcalOverride"
      from profiles where user_id = ${userId}
    `,
    sql`
      select id, barcode, name, brand, base_unit as "baseUnit", kcal,
             protein_g as "proteinG", carbs_g as "carbsG", fat_g as "fatG",
             fiber_g as "fiberG", sugar_g as "sugarG", satfat_g as "satfatG",
             salt_g as "saltG", serving_g as "servingG", source, favorite
      from foods where user_id = ${userId}
      order by updated_at desc
      limit 1000
    `,
    sql`
      select id, to_char(day, 'YYYY-MM-DD') as day, meal, food_id as "foodId", name,
             qty_g as "qtyG", kcal, protein_g as "proteinG", carbs_g as "carbsG",
             fat_g as "fatG", fiber_g as "fiberG", sugar_g as "sugarG", satfat_g as "satfatG"
      from diary_entries
      where user_id = ${userId} and day > current_date - 400
      order by day, created_at
    `,
    sql`
      select to_char(day, 'YYYY-MM-DD') as day, weight_kg as "weightKg"
      from weights where user_id = ${userId}
      order by day
    `,
    sql`
      select id, to_char(day, 'YYYY-MM-DD') as day, kind, title,
             duration_min as "durationMin", rpe, kcal, notes
      from workouts
      where user_id = ${userId} and day > current_date - 400
      order by day, created_at
    `,
    sql`
      select to_char(day, 'YYYY-MM-DD') as day, steps
      from daily_steps where user_id = ${userId} and day > current_date - 400
      order by day
    `,
    sql`
      select id, role, content, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt"
      from chat_messages where user_id = ${userId}
      order by created_at desc
      limit 60
    `,
  ]);

  if ((users as { email: string }[]).length === 0) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  return NextResponse.json({
    email: (users as { email: string }[])[0].email,
    profile: (profiles as object[])[0] ?? DEFAULT_PROFILE,
    foods,
    diary,
    weights,
    workouts,
    steps,
    chat: (chat as object[]).reverse(),
  });
}
