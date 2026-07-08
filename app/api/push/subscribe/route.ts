import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";

/** Push-Subscription dieses Geräts registrieren (Upsert über den Endpoint). */
export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "Ungültige Subscription." }, { status: 400 });
  }

  await db()`
    insert into push_subscriptions (user_id, endpoint, p256dh, auth)
    values (${userId}, ${endpoint}, ${p256dh}, ${auth})
    on conflict (endpoint)
    do update set user_id = ${userId}, p256dh = ${p256dh}, auth = ${auth}
  `;
  return NextResponse.json({ ok: true });
}

/** Subscription dieses Geräts entfernen. */
export async function DELETE(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: { endpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "Endpoint fehlt." }, { status: 400 });

  await db()`
    delete from push_subscriptions where endpoint = ${endpoint} and user_id = ${userId}
  `;
  return NextResponse.json({ ok: true });
}
