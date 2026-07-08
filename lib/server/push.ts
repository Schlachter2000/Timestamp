import webpush from "web-push";
import { db } from "./db";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:push@example.com";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID-Keys sind nicht gesetzt (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sendet eine Payload an alle Subscriptions eines Nutzers.
 * Abgelaufene Subscriptions (404/410 vom Push-Dienst) werden gelöscht.
 * Gibt die Zahl erfolgreicher Zustellungen zurück.
 */
export async function sendToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: { title: string; body: string }
): Promise<number> {
  ensureConfigured();
  const sql = db();
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          {
            TTL: 10 * 60, // nach 10 Minuten ist die Erinnerung veraltet
            // Lokale Entwicklung hinter einem Egress-Proxy; auf Vercel ungesetzt.
            ...(process.env.HTTPS_PROXY ? { proxy: process.env.HTTPS_PROXY } : {}),
          }
        );
        delivered++;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await sql`delete from push_subscriptions where id = ${sub.id}`;
        }
        // andere Fehler (z. B. Netz): nächster Cron-Lauf versucht es erneut
      }
    })
  );
  return delivered;
}
