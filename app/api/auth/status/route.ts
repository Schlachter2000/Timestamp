import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";

/** Für die Login-Seite: Gibt es schon ein Konto? */
export async function GET() {
  const rows = (await db()`select count(*)::int as count from users`) as { count: number }[];
  return NextResponse.json({ hasUser: rows[0].count > 0 });
}
