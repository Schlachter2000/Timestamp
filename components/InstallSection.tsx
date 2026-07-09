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
 * In-App-Hinweis zur Installation. Auf dem iPhone bekommt Bilanz erst über
 * "Zum Home-Bildschirm" ein eigenes Icon, Vollbild und stabilen Kamerazugriff
 * für den Barcode-Scanner. Android/Desktop nutzen den nativen Install-Prompt.
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
        <p className="hint">✓ Bilanz läuft bereits als installierte App.</p>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <h2>App installieren</h2>
      {platform === "ios" ? (
        <>
          <p className="hint">
            Auf dem iPhone wird Bilanz über den Home-Bildschirm zur vollwertigen App:
          </p>
          <ol className="install-steps">
            <li>Diese Seite in <strong>Safari</strong> öffnen (nicht in einem In-App-Browser).</li>
            <li>Unten das <strong>Teilen-Symbol</strong> antippen (Quadrat mit Pfeil nach oben).</li>
            <li>In der Liste <strong>„Zum Home-Bildschirm“</strong> wählen.</li>
            <li>Mit <strong>„Hinzufügen“</strong> bestätigen und Bilanz vom Home-Bildschirm starten.</li>
          </ol>
        </>
      ) : platform === "installable" ? (
        <>
          <p className="hint">Installiere Bilanz als App – eigenes Fenster, Icon im Launcher.</p>
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
          <strong>„Bilanz installieren“</strong> (bzw. „Apps“). Auf dem iPhone: In Safari über
          Teilen → „Zum Home-Bildschirm“.
        </p>
      )}
    </section>
  );
}
