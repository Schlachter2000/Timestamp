"use client";

import { useEffect, useState } from "react";
import { updateSettings, useStore } from "@/lib/store";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

type DeviceState = "unsupported" | "ios-browser" | "denied" | "off" | "on" | "busy";

/**
 * Push-Erinnerungen: globaler An/Aus-Schalter mit Zeitfenster (Server steuert
 * den Versand) plus Subscription des aktuellen Geräts. iOS im Browser bekommt
 * den Hinweis auf die Installation, weil Web Push dort nur installiert läuft.
 */
export function PushSection() {
  const store = useStore();
  const settings = store.settings;
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        const isIOS =
          /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as { standalone?: boolean }).standalone === true;
        setDevice(isIOS && !standalone ? "ios-browser" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setDevice("denied");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setDevice(subscription ? "on" : "off");
    })();
  }, []);

  async function enableOnThisDevice() {
    setError(null);
    setDevice("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("VAPID Public Key fehlt im Build.");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("Server hat die Subscription abgelehnt.");
      updateSettings({
        pushEnabled: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setDevice("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktivierung fehlgeschlagen.");
      setDevice("off");
    }
  }

  async function disableOnThisDevice() {
    setError(null);
    setDevice("busy");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setDevice("off");
    } catch {
      setDevice("off");
    }
  }

  return (
    <section className="settings-section">
      <h2>Push-Benachrichtigungen</h2>
      <p className="hint">
        Erinnert dich alle 15 Minuten daran, den aktuellen Slot zu erfassen – nur innerhalb des
        Zeitfensters.
      </p>

      {device === null ? null : device === "ios-browser" ? (
        <p className="hint">
          Auf dem iPhone/iPad gibt es Push nur in der <strong>installierten</strong> App (iOS 16.4+).
          Folge zuerst der Anleitung unter „App installieren“, öffne Timestamp vom Home-Bildschirm
          und aktiviere Push dann hier.
        </p>
      ) : device === "unsupported" ? (
        <p className="hint">Dieser Browser unterstützt keine Web-Push-Benachrichtigungen.</p>
      ) : device === "denied" ? (
        <p className="hint">
          Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den
          Website-Einstellungen des Browsers und lade die Seite neu.
        </p>
      ) : (
        <>
          <div className="push-row">
            <span className="push-label">
              Erinnerungen auf diesem Gerät
              <small>{device === "on" ? "aktiv" : device === "busy" ? "…" : "aus"}</small>
            </span>
            <button
              className={`toggle${device === "on" ? " on" : ""}`}
              role="switch"
              aria-checked={device === "on"}
              aria-label="Push-Erinnerungen auf diesem Gerät"
              disabled={device === "busy"}
              onClick={() => void (device === "on" ? disableOnThisDevice() : enableOnThisDevice())}
            >
              <span className="knob" />
            </button>
          </div>

          <div className="push-row">
            <span className="push-label">
              Zeitfenster
              <small>täglich, lokale Zeit</small>
            </span>
            <span className="push-times">
              <input
                type="time"
                step={900}
                value={minutesToTime(settings.pushWindowStart)}
                aria-label="Zeitfenster Beginn"
                onChange={(e) => updateSettings({ pushWindowStart: timeToMinutes(e.target.value) })}
              />
              –
              <input
                type="time"
                step={900}
                value={minutesToTime(settings.pushWindowEnd)}
                aria-label="Zeitfenster Ende"
                onChange={(e) => updateSettings({ pushWindowEnd: timeToMinutes(e.target.value) })}
              />
            </span>
          </div>

          {settings.pushEnabled && device === "off" && (
            <p className="hint">
              Push ist für dein Konto aktiv, aber dieses Gerät ist nicht angemeldet – Schalter oben
              aktivieren, wenn es auch hier erinnern soll.
            </p>
          )}
          {error && <p className="login-error">{error}</p>}
        </>
      )}
    </section>
  );
}
