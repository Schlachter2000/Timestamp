import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";

/**
 * Kompletter Datenstand für den Client: Nutzer, Kategorien, alle Einträge.
 * Eine Antwort pro App-Start bzw. Sync-Tick; bei 96 Slots/Tag bleibt das
 * Volumen auch nach Monaten klein.
 */
export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const sql = db();
  const [users, categories, entries, settings] = await Promise.all([
    sql`select email from users where id = ${userId}`,
    sql`
      select id, name, color, position, archived
      from categories where user_id = ${userId}
      order by position
    `,
    sql`
      select to_char(day, 'YYYY-MM-DD') as day, slot, category_id as "categoryId", note
      from entries where user_id = ${userId}
      order by day, slot
    `,
    sql`
      select push_enabled as "pushEnabled", push_window_start as "pushWindowStart",
             push_window_end as "pushWindowEnd", timezone
      from user_settings where user_id = ${userId}
    `,
  ]);

  if ((users as { email: string }[]).length === 0) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const settingsRow = (settings as object[])[0] ?? {
    pushEnabled: false,
    pushWindowStart: 480,
    pushWindowEnd: 1320,
    timezone: "Europe/Berlin",
  };

  return NextResponse.json({
    email: (users as { email: string }[])[0].email,
    categories,
    entries,
    settings: settingsRow,
  });
}
