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
  const [users, categories, entries] = await Promise.all([
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
  ]);

  if ((users as { email: string }[]).length === 0) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  return NextResponse.json({
    email: (users as { email: string }[])[0].email,
    categories,
    entries,
  });
}
