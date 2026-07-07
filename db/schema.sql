-- =============================================================================
-- Timestamp – Postgres-Schema
--
-- Wird in Phase 2 gegen die gehostete Datenbank (Supabase oder Neon)
-- ausgeführt. Das Schema deckt bereits alle Phasen ab:
--   Phase 2: users, categories, entries
--   Phase 4: push_subscriptions, user_settings (Push-Zeitfenster)
--   Phase 5/6: user_settings (Google-Tokens, Anthropic-Key – serverseitig)
--
-- Zeitmodell: Ein Tag hat 96 Slots à 15 Minuten (Slot 0 = 00:00–00:15,
-- Slot 95 = 23:45–24:00). Gespeichert wird das lokale Kalenderdatum plus
-- Slot-Index – das entspricht exakt dem mentalen Modell der Tagesansicht
-- und macht Tages-/Wochen-/Monatsabfragen trivial.
-- =============================================================================

create extension if not exists pgcrypto; -- für gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Nutzer (Phase 2: Magic-Link-Auth; ein Konto genügt, Schema erlaubt mehrere)
-- -----------------------------------------------------------------------------
create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Kategorien mit Farbcode, frei erweiterbar. Archivieren statt Löschen,
-- damit alte Einträge ihre Farbe behalten.
-- -----------------------------------------------------------------------------
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  color      text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  position   integer not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists categories_user_idx on categories (user_id);

-- -----------------------------------------------------------------------------
-- Einträge: genau ein Eintrag pro Nutzer, Tag und 15-Minuten-Slot.
-- Kategorie ODER Freitext (oder beides) muss gesetzt sein.
-- -----------------------------------------------------------------------------
create table if not exists entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  day         date not null,
  slot        smallint not null check (slot between 0 and 95),
  category_id uuid references categories(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, day, slot),
  check (category_id is not null or note is not null)
);

create index if not exists entries_user_day_idx on entries (user_id, day);

-- -----------------------------------------------------------------------------
-- Web-Push-Subscriptions (Phase 4). Ein Nutzer kann mehrere Geräte haben.
-- -----------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- -----------------------------------------------------------------------------
-- Einstellungen pro Nutzer.
--   Phase 4: Push an/aus + Zeitfenster (Minuten seit Mitternacht, lokale Zeit)
--   Phase 6: Anthropic-API-Key – verschlüsselt abgelegt, nie ans Frontend
-- -----------------------------------------------------------------------------
create table if not exists user_settings (
  user_id                  uuid primary key references users(id) on delete cascade,
  push_enabled             boolean not null default false,
  push_window_start        smallint not null default 480  check (push_window_start between 0 and 1439),  -- 08:00
  push_window_end          smallint not null default 1320 check (push_window_end between 0 and 1439),    -- 22:00
  timezone                 text not null default 'Europe/Berlin',
  anthropic_key_encrypted  text,
  updated_at               timestamptz not null default now()
);
