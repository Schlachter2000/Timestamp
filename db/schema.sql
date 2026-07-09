-- =============================================================================
-- Bilanz – Postgres-Schema
--
-- Ernährungs-, Trainings- und Gewichts-Tracking mit adaptivem TDEE und
-- Claude-Coach. Der Client arbeitet offline-first: Mutationen tragen
-- client-generierte UUIDs und werden idempotent per Upsert eingespielt.
--
-- Einheiten: Nährwerte je 100 g (bzw. 100 ml), Mengen in Gramm,
-- Gewicht in kg, Dauer in Minuten, Energie in kcal.
-- =============================================================================

create extension if not exists pgcrypto; -- für gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Nutzer: Login mit E-Mail + Passwort; Single-User-App, Registrierung
-- schließt nach dem ersten Konto.
-- -----------------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Profil & Ziele. Aus diesen Werten leitet lib/science.ts Startwert-TDEE,
-- Kalorienbudget und Makroziele ab; der adaptive TDEE ersetzt die Formel,
-- sobald genug Verlaufsdaten existieren.
-- -----------------------------------------------------------------------------
create table if not exists profiles (
  user_id             uuid primary key references users(id) on delete cascade,
  sex                 text not null default 'm' check (sex in ('m', 'w')),
  birth_year          smallint not null default 1995 check (birth_year between 1900 and 2030),
  height_cm           smallint not null default 180 check (height_cm between 100 and 250),
  activity_level      real not null default 1.4 check (activity_level between 1.2 and 2.4),
  goal                text not null default 'recomp' check (goal in ('cut', 'recomp', 'gain', 'maintain')),
  weekly_rate_pct     real not null default -0.25 check (weekly_rate_pct between -1.5 and 1.0),
  protein_g_per_kg    real not null default 2.2 check (protein_g_per_kg between 1.0 and 3.5),
  fat_g_per_kg        real not null default 0.9 check (fat_g_per_kg between 0.5 and 2.0),
  activity_credit_pct smallint not null default 50 check (activity_credit_pct between 0 and 100),
  kcal_override       integer check (kcal_override between 1000 and 6000),
  updated_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Lebensmittel: pro Nutzer gecacht (Barcode-Scans aus Open Food Facts)
-- oder händisch angelegt. Nährwerte je 100 g/ml.
-- -----------------------------------------------------------------------------
create table if not exists foods (
  id          uuid primary key,
  user_id     uuid not null references users(id) on delete cascade,
  barcode     text,
  name        text not null,
  brand       text,
  base_unit   text not null default 'g' check (base_unit in ('g', 'ml')),
  kcal        real not null default 0,
  protein_g   real not null default 0,
  carbs_g     real not null default 0,
  fat_g       real not null default 0,
  fiber_g     real not null default 0,
  sugar_g     real not null default 0,
  satfat_g    real not null default 0,
  salt_g      real not null default 0,
  serving_g   real,
  source      text not null default 'manual' check (source in ('off', 'manual')),
  favorite    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists foods_user_idx on foods (user_id);
create index if not exists foods_user_barcode_idx on foods (user_id, barcode);

-- -----------------------------------------------------------------------------
-- Ernährungstagebuch: ein Eintrag = eine gegessene Menge. Nährwerte werden
-- denormalisiert gespeichert, damit spätere Food-Edits die Historie nicht
-- verfälschen und Auswertungen ohne Join laufen.
-- -----------------------------------------------------------------------------
create table if not exists diary_entries (
  id         uuid primary key,
  user_id    uuid not null references users(id) on delete cascade,
  day        date not null,
  meal       text not null check (meal in ('fruehstueck', 'mittag', 'abend', 'snack')),
  food_id    uuid references foods(id) on delete set null,
  name       text not null,
  qty_g      real not null check (qty_g > 0),
  kcal       real not null default 0,
  protein_g  real not null default 0,
  carbs_g    real not null default 0,
  fat_g      real not null default 0,
  fiber_g    real not null default 0,
  sugar_g    real not null default 0,
  satfat_g   real not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diary_user_day_idx on diary_entries (user_id, day);

-- -----------------------------------------------------------------------------
-- Gewicht: eine Messung pro Tag; Trend wird clientseitig geglättet.
-- -----------------------------------------------------------------------------
create table if not exists weights (
  user_id    uuid not null references users(id) on delete cascade,
  day        date not null,
  weight_kg  real not null check (weight_kg between 30 and 300),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- -----------------------------------------------------------------------------
-- Training & Aktivitäten: MET-basierte Verbrauchsrechnung im Client,
-- kcal wird gespeichert (inkl. manueller Übersteuerung).
-- -----------------------------------------------------------------------------
create table if not exists workouts (
  id           uuid primary key,
  user_id      uuid not null references users(id) on delete cascade,
  day          date not null,
  kind         text not null,
  title        text,
  duration_min smallint not null check (duration_min between 1 and 1440),
  rpe          smallint check (rpe between 1 and 10),
  kcal         real not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists workouts_user_day_idx on workouts (user_id, day);

-- -----------------------------------------------------------------------------
-- Schritte: Tagessumme (NEAT-Anteil, geht anteilig in die Aktivitäts-Gutschrift).
-- -----------------------------------------------------------------------------
create table if not exists daily_steps (
  user_id    uuid not null references users(id) on delete cascade,
  day        date not null,
  steps      integer not null check (steps between 0 and 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- -----------------------------------------------------------------------------
-- Coach-Chat: Verlauf der Claude-Konversation (Kontext für Folgefragen).
-- -----------------------------------------------------------------------------
create table if not exists chat_messages (
  id         uuid primary key,
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_user_idx on chat_messages (user_id, created_at);
