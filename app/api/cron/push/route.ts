import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { sendToSubscriptions, type PushSubscriptionRow } from "@/lib/server/push";

export const dynamic = "force-dynamic";

/** Minuten seit Mitternacht in einer IANA-Zeitzone. */
function minutesOfDayIn(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("de-DE", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    return new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  }
}

/** Liegt `minutes` im Fenster [start, end)? Fenster über Mitternacht erlaubt. */
function inWindow(minutes: number, start: number, end: number): boolean {
  if (start === end) return true; // 24h-Fenster
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end; // z. B. 22:00–06:00
}

function slotLabel(minutes: number): string {
  const startMin = Math.floor(minutes / 15) * 15;
  const fmt = (m: number) => {
    const total = m % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  return `${fmt(startMin)} – ${fmt(startMin + 15)}`;
}

/**
 * Scheduler-Endpunkt: wird alle 15 Minuten von außen aufgerufen
 * (Vercel Cron auf Pro, sonst z. B. cron-job.org). Schickt an alle Nutzer
 * mit aktivem Push, deren lokales Zeitfenster gerade offen ist.
 * Auth: Authorization: Bearer CRON_SECRET (oder ?key= für einfache Cron-Dienste).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET ist nicht konfiguriert." }, { status: 500 });
  }
  const url = new URL(request.url);
  const header = request.headers.get("authorization");
  const authorized = header === `Bearer ${secret}` || url.searchParams.get("key") === secret;
  if (!authorized) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const sql = db();
  const users = (await sql`
    select s.user_id as "userId", s.push_window_start as "windowStart",
           s.push_window_end as "windowEnd", s.timezone
    from user_settings s
    where s.push_enabled = true
  `) as { userId: string; windowStart: number; windowEnd: number; timezone: string }[];

  let notified = 0;
  let delivered = 0;

  for (const user of users) {
    const minutes = minutesOfDayIn(user.timezone);
    if (!inWindow(minutes, user.windowStart, user.windowEnd)) continue;

    const subscriptions = (await sql`
      select id, endpoint, p256dh, auth from push_subscriptions where user_id = ${user.userId}
    `) as PushSubscriptionRow[];
    if (subscriptions.length === 0) continue;

    notified++;
    delivered += await sendToSubscriptions(subscriptions, {
      title: "Timestamp",
      body: `Was machst du gerade? (${slotLabel(minutes)})`,
    });
  }

  return NextResponse.json({ ok: true, users: notified, delivered });
}
