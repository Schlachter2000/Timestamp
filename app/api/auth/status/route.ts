import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";

/** Öffentlich: Gibt es schon ein Konto? Steuert Login- vs. Registrieren-UI. */
export async function GET() {
  const sql = db();
  const rows = (await sql`select count(*)::int as count from users`) as { count: number }[];
  return NextResponse.json({ hasUser: rows[0].count > 0 });
}
