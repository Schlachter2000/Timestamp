"use client";

// Kamera-Barcode-Scanner auf zxing-Basis (reines JS + WebAssembly-frei),
// funktioniert damit auch in iOS Safari / installierten PWAs.
// Gescannt werden EAN-13/EAN-8/UPC – die Formate von Lebensmittel-Barcodes.

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

export function BarcodeScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    let controls: IScannerControls | null = null;
    let done = false;

    if (!videoRef.current) return;
    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current,
        (result) => {
          if (result && !done) {
            done = true;
            if (navigator.vibrate) navigator.vibrate(60);
            onScanRef.current(result.getText());
          }
        }
      )
      .then((c) => {
        controls = c;
      })
      .catch((err: unknown) => {
        const name = err instanceof Error ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Kamerazugriff wurde abgelehnt. Erlaube ihn in den Website-Einstellungen."
            : "Kamera konnte nicht gestartet werden."
        );
      });

    return () => {
      controls?.stop();
    };
  }, []);

  return (
    <div>
      <div className="scanner-view">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted />
        <div className="scanner-frame" />
      </div>
      <p className="scanner-status">{error ?? "Barcode ins Bild halten …"}</p>
    </div>
  );
}
