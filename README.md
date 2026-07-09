# Bilanz

Installierbare PWA für Ernährungs-, Trainings- und Gewichts-Tracking mit
sportwissenschaftlichem Kern und Claude als Coach. Läuft offline-first auf dem
Handy (Barcode-Scan im Supermarkt, Logging im Gym ohne Netz) und synchronisiert
im Hintergrund.

## Was die App wissenschaftlich anders macht

- **Adaptiver TDEE** – Der Kalorienverbrauch wird nicht dauerhaft aus einer
  Formel geschätzt, sondern nach ~2 Wochen Protokoll aus Energiezufuhr und
  Trendgewicht zurückgerechnet (Energiebilanzmethode, 7700 kcal/kg). Individuelle
  Stoffwechselunterschiede und adaptive Thermogenese sind damit automatisch drin.
- **Trendgewicht** – Exponentiell geglätteter Verlauf statt Tageswert; Wasser-
  und Glykogenschwankungen verschwinden aus der Kurve und aus den Entscheidungen.
- **Ehrliche Aktivitäts-Gutschrift** – Trainingsverbrauch wird netto ((MET − 1))
  gerechnet und standardmäßig nur zu 50 % gutgeschrieben; Schritte zählen erst
  oberhalb von 7.500/Tag. Das verhindert das klassische Doppelzählen, an dem die
  meisten Tracking-Apps scheitern.
- **Rekomposition als eigenes Ziel** – Kalorien um Erhaltung, Protein 2,2 g/kg,
  Protein-Schwelle pro Mahlzeit (~0,4 g/kg) als anaboler Reiz.
- **Qualitäts-Score (0–100)** – Protein, Ballaststoffe (14 g/1000 kcal) und
  WHO-Grenzen für Zucker/gesättigte Fette, damit „Kalorien passen“ nicht das
  einzige Signal ist.
- **Coach mit Datenzugriff** – Claude bekommt bei jeder Frage die echte Bilanz
  (offene Kalorien, Protein-Lücke, Trend, Trainingswoche, Lieblingsessen) und
  schlägt darauf abgestimmte Gerichte vor.

## Tech-Stack

- **Next.js (App Router) + TypeScript** – Frontend und API-Routes
- **Postgres (Neon)** – Quelle der Wahrheit, Sync über Geräte
- **Offline-first Client** – Snapshot + Mutations-Outbox in IndexedDB,
  idempotente Upserts mit Client-UUIDs
- **@zxing/browser** – Barcode-Scan (EAN/UPC) direkt in der Kamera, iOS-tauglich
- **Open Food Facts** – Produktdatenbank für Scan und Suche (Server-Proxy + Cache)
- **Claude API** (`@anthropic-ai/sdk`) – Coach-Chat mit Streaming, Key bleibt serverseitig
- Design: „Studio“ – Papierweiß/Tannengrün, feine Linien, Mono-Ziffern

## Lokal starten

```bash
npm install
cp .env.example .env.local   # DATABASE_URL (Neon), AUTH_SECRET, ANTHROPIC_API_KEY
npm run db:schema            # Schema in die Datenbank einspielen (einmalig)
npm run dev
```

Dann <http://localhost:3000> öffnen. Beim ersten Start legt man auf der
Login-Seite das (einzige) Konto an; danach ist die Registrierung geschlossen.
Produktions-Build prüfen: `npm run build && npm start`.

**Aufs iPhone bringen:** Auf Vercel deployen (Env-Variablen setzen), die URL in
Safari öffnen und über Teilen → „Zum Home-Bildschirm“ installieren. Kamera
(Scanner) braucht HTTPS – lokal geht der Scan daher nur eingeschränkt.

## Projektstruktur

| Pfad | Inhalt |
| --- | --- |
| `app/` | Seiten: Heute, Training, Coach, Fortschritt, Einstellungen, Login |
| `app/api/` | Auth, Daten-Sync, Tagebuch/Foods/Gewicht/Training, Barcode & Suche (OFF-Proxy), Coach (Claude) |
| `components/` | Kalorienring, Makro-Balken, Barcode-Scanner, Sheets, Gewichts-Chart |
| `lib/science.ts` | TDEE (Formel + adaptiv), Trendgewicht, Ziele, MET-Katalog, Qualitäts-Score |
| `lib/store.ts` | Offline-first Store (IndexedDB-Snapshot + Outbox) |
| `db/schema.sql` | Postgres-Schema (Profil, Foods, Tagebuch, Gewicht, Training, Schritte, Chat) |

## Architektur-Notizen

- **Offline-first:** Der Store lädt beim Start den letzten Snapshot aus
  IndexedDB und ist sofort benutzbar. Mutationen werden optimistisch angewendet
  und in einer persistenten Outbox gesammelt; online werden sie idempotent
  (Client-UUIDs + Upserts) abgespielt, danach gleicht ein Refetch ab.
- **Nährwerte denormalisiert:** Tagebucheinträge speichern ihre Nährwerte als
  Kopie – spätere Produkt-Edits verfälschen die Historie nicht.
- **Barcode:** Kamera-Scan (EAN-13/8, UPC) → eigener Food-Cache → Open Food
  Facts. Nicht gefundene Produkte landen vorausgefüllt in der manuellen Eingabe.
- **Coach:** `/api/coach` streamt Claude-Antworten (Opus 4.8, adaptives Denken).
  Der Server baut pro Anfrage einen Kontextblock aus Profil, Zielen, offener
  Tagesbilanz, 7-Tage-Mitteln, Trainingswoche und häufigen Lebensmitteln;
  der Chatverlauf liegt in Postgres.
- **Umgebungsvariablen** (lokal `.env.local`, in Vercel unter *Settings →
  Environment Variables*): `DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`.
- **Icons neu bauen:** `node scripts/make-icons.mjs` (rendert `app/icon.svg`
  über Playwright in die PNG-Größen).
