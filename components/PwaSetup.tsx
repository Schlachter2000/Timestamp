"use client";

import { useEffect } from "react";

// Chrome/Edge feuern beforeinstallprompt früh – hier global einfangen,
// damit die Einstellungen-Seite den Prompt später anbieten kann.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function PwaSetup() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new CustomEvent("pwa-installable"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // z. B. privater Modus – App funktioniert auch ohne SW
      });
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return null;
}
