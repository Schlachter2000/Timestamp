import { NextResponse } from "next/server";
import { sessionUserId } from "@/lib/server/auth";
import { offSearch } from "@/lib/server/off";

/** Produktsuche in Open Food Facts (?q=…). Eigene Lebensmittel filtert der Client lokal. */
export async function GET(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await offSearch(q.slice(0, 100));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Open Food Facts nicht erreichbar." }, { status: 502 });
  }
}
