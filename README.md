# Timestamp

Installierbare PWA für Zeittracking im 15-Minuten-Takt: Tag in 96 Slots erfassen,
Verlauf und Auswertung ansehen, alle 15 Minuten per Push erinnert werden.

## Tech-Stack

- **Next.js (App Router) + TypeScript** – Frontend, API-Routes und Vercel-Cron in einem Framework
- **Postgres** (Supabase oder Neon) – Cross-Device-Sync *(ab Phase 2)*
- **Web Push** mit VAPID *(ab Phase 4)*, **Google Sheets Export** *(Phase 5)*, **Claude-Analyse** *(Phase 6)*
- Design: „Werkbank“ – Papierweiß/Anthrazit, feine Linien, Monospace-Zeiten, Ultramarin-Akzent

## Lokal starten

```bash
npm install
cp .env.example .env.local   # DATABASE_URL (Neon) und AUTH_SECRET eintragen
npm run db:schema            # Schema in die Datenbank einspielen (einmalig)
npm run dev
```

Dann <http://localhost:3000> öffnen. Beim ersten Start legt man auf der
Login-Seite das (einzige) Konto an; danach ist die Registrierung geschlossen.
Produktions-Build prüfen:

```bash
npm run build && npm start
```

## Projektstruktur

| Pfad | Inhalt |
| --- | --- |
| `app/` | Seiten: Heute (Tagesraster), Verlauf (Woche/Monat), Auswertung, Einstellungen |
| `components/` | `DayTimeline` (96-Slot-Timeline), `EntrySheet` (Schnelleingabe), `TabBar` |
| `lib/` | Slot-/Datums-Arithmetik, Datenschicht (`store.ts`), Typen |
| `db/schema.sql` | Postgres-Schema für alle Phasen (Nutzer, Kategorien, Einträge, Push, Settings) |
| `public/fonts/` | Archivo + IBM Plex Mono, lokal eingebunden (kein Google-Fonts-Request) |

## Phasenstand

- [x] **Phase 1** – Grundgerüst, DB-Schema, Tracking-UI (Daten lokal im Browser)
- [x] **Phase 2** – Auth (E-Mail + Passwort) + Cross-Device-Sync über Neon-Postgres
- [x] **Phase 3** – PWA (Manifest, Service Worker, Installierbarkeit, iOS-Anleitung)
- [x] **Phase 4** – Push-Benachrichtigungen (VAPID, 15-Minuten-Scheduler, Zeitfenster)
- [ ] **Phase 5** – Google Sheets Export (OAuth2)
- [ ] **Phase 6** – Claude-Analyse (Anthropic API, Key serverseitig)

## Architektur-Notizen

- **Datenfluss:** Der Server ist die Quelle der Wahrheit. `lib/store.ts` hält
  eine reaktive Kopie, wendet Mutationen optimistisch an und schreibt sie an
  die API-Routes; Refetch bei Fokus/Sichtbarkeit und alle 60 s hält mehrere
  Geräte synchron. Ein evtl. vorhandener Phase-1-Stand aus `localStorage`
  wird beim ersten Login einmalig importiert.
- **Auth:** scrypt-Passwort-Hash (node:crypto), zustandslose HMAC-signierte
  Session im httpOnly-Cookie. Die Registrierung ist offen, bis das erste
  Konto existiert, danach geschlossen (Single-User-App).
- **Umgebungsvariablen** (lokal in `.env.local`, in Vercel unter *Settings →
  Environment Variables*, Namen siehe `.env.example`): `DATABASE_URL`,
  `AUTH_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`, `CRON_SECRET`.
- **Push-Scheduler:** `GET /api/cron/push` (geschützt durch `CRON_SECRET` als
  `Authorization: Bearer …` oder `?key=…`) schickt an alle Konten mit aktivem
  Push, deren lokales Zeitfenster offen ist. Alle 15 Minuten aufrufen:
  auf Vercel **Pro** per Vercel Cron (`vercel.json`:
  `{"crons":[{"path":"/api/cron/push","schedule":"*/15 * * * *"}]}` – Vercel
  sendet den `CRON_SECRET`-Header automatisch), auf dem **Hobby-Plan** (Cron
  dort max. 1×/Tag) per externem Dienst wie cron-job.org.
- **iOS:** Web Push erst ab iOS 16.4 und nur in der über „Zum Home-Bildschirm“
  installierten App – die Einstellungen zeigen die passende Anleitung an.
