import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";

function validMinutes(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1439 ? v : null;
}

/** Push-Einstellungen ändern: an/aus, Zeitfenster, Zeitzone. */
export async function PATCH(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let body: {
    pushEnabled?: unknown;
    pushWindowStart?: unknown;
    pushWindowEnd?: unknown;
    timezone?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const pushEnabled = typeof body.pushEnabled === "boolean" ? body.pushEnabled : null;
  const windowStart = validMinutes(body.pushWindowStart);
  const windowEnd = validMinutes(body.pushWindowEnd);
  let timezone: string | null = null;
  if (typeof body.timezone === "string") {
    try {
      new Intl.DateTimeFormat("de-DE", { timeZone: body.timezone });
      timezone = body.timezone;
    } catch {
      return NextResponse.json({ error: "Unbekannte Zeitzone." }, { status: 400 });
    }
  }

  await db()`
    insert into user_settings (user_id, push_enabled, push_window_start, push_window_end, timezone)
    values (
      ${userId}, coalesce(${pushEnabled}, false), coalesce(${windowStart}, 480),
      coalesce(${windowEnd}, 1320), coalesce(${timezone}, 'Europe/Berlin')
    )
    on conflict (user_id) do update set
      push_enabled = coalesce(${pushEnabled}, user_settings.push_enabled),
      push_window_start = coalesce(${windowStart}, user_settings.push_window_start),
      push_window_end = coalesce(${windowEnd}, user_settings.push_window_end),
      timezone = coalesce(${timezone}, user_settings.timezone),
      updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}
