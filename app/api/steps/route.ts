import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";
import { day, num } from "@/lib/server/validate";

/** Schritte für einen Tag setzen (0 löscht den Eintrag). */
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
  const steps = num(body.steps, 0, 200000);
  if (!entryDay || steps === null) {
    return NextResponse.json({ error: "Ungültige Schritte." }, { status: 400 });
  }

  if (steps === 0) {
    await db()`delete from daily_steps where user_id = ${userId} and day = ${entryDay}`;
  } else {
    await db()`
      insert into daily_steps (user_id, day, steps, updated_at)
      values (${userId}, ${entryDay}, ${Math.round(steps)}, now())
      on conflict (user_id, day) do update set steps = excluded.steps, updated_at = now()
    `;
  }
  return NextResponse.json({ ok: true });
}
