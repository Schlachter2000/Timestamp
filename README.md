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
npm run dev
```

Dann <http://localhost:3000> öffnen. Produktions-Build prüfen:

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
- [ ] **Phase 2** – Auth + Cross-Device-Sync über Postgres
- [ ] **Phase 3** – PWA (Manifest, Service Worker, Installierbarkeit)
- [ ] **Phase 4** – Push-Benachrichtigungen (VAPID, Vercel Cron, Zeitfenster)
- [ ] **Phase 5** – Google Sheets Export (OAuth2)
- [ ] **Phase 6** – Claude-Analyse (Anthropic API, Key serverseitig)

**Hinweis Phase 1:** Einträge und Kategorien liegen vorerst in `localStorage`
(`lib/store.ts`). Die Funktionssignaturen entsprechen bereits den späteren
API-Routen; Phase 2 tauscht nur die Implementierung gegen Server-Sync aus.
