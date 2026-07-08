"use client";

import { useEffect, useState } from "react";
import { getInstallPrompt } from "./PwaSetup";

type Platform = "standalone" | "ios" | "installable" | "other";

function detectPlatform(): Platform {
  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  ) {
    return "standalone";
  }
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS meldet sich als Mac mit Touch
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (getInstallPrompt()) return "installable";
  return "other";
}

/**
 * In-App-Hinweis zur Installation. Auf iOS läuft Web Push (ab 16.4) nur,
 * wenn die App über "Zum Home-Bildschirm" installiert wurde – daher die
 * Schritt-für-Schritt-Anleitung. Android/Desktop bekommen den nativen
 * Install-Prompt, wenn der Browser ihn anbietet.
 */
export function InstallSection() {
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    const onInstallable = () => setPlatform(detectPlatform());
    window.addEventListener("pwa-installable", onInstallable);
    return () => window.removeEventListener("pwa-installable", onInstallable);
  }, []);

  if (platform === null) return null;

  if (platform === "standalone") {
    return (
      <section className="settings-section">
        <h2>App installieren</h2>
        <p className="hint">✓ Timestamp läuft bereits als installierte App.</p>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <h2>App installieren</h2>
      {platform === "ios" ? (
        <>
          <p className="hint">
            Auf dem iPhone/iPad muss Timestamp zum Home-Bildschirm hinzugefügt werden – nur dann
            funktionieren später auch die Push-Erinnerungen (ab iOS 16.4):
          </p>
          <ol className="install-steps">
            <li>Diese Seite in <strong>Safari</strong> öffnen (nicht in einem In-App-Browser).</li>
            <li>Unten das <strong>Teilen-Symbol</strong> antippen (Quadrat mit Pfeil nach oben).</li>
            <li>In der Liste <strong>„Zum Home-Bildschirm“</strong> wählen.</li>
            <li>Mit <strong>„Hinzufügen“</strong> bestätigen und Timestamp vom Home-Bildschirm starten.</li>
          </ol>
        </>
      ) : platform === "installable" ? (
        <>
          <p className="hint">Installiere Timestamp als App – eigenes Fenster, Icon im Launcher.</p>
          <button
            className="btn primary"
            style={{ flex: "none" }}
            onClick={() => void getInstallPrompt()?.prompt()}
          >
            App installieren
          </button>
        </>
      ) : (
        <p className="hint">
          In Chrome oder Edge findest du die Installation im Browser-Menü unter{" "}
          <strong>„Timestamp installieren“</strong> (bzw. „Apps“). Auf dem iPhone: In Safari über
          Teilen → „Zum Home-Bildschirm“.
        </p>
      )}
    </section>
  );
}
