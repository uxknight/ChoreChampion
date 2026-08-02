-- Chore Champions — Phase 1: schema
-- Ports the prototype (chore-champions.html) data model to Postgres.
-- Timezone is America/Los_Angeles; ISO weeks start Monday; biweekly = even ISO weeks.
--
-- DEVIATION FROM BRIEF B3: the brief writes `profiles(id references auth.users)`.
-- The brief's own kid model (pre-existing kid profiles, multiple parent-approved
-- devices per kid, anonymous sessions) requires profile identity to be independent
-- of auth identity. We therefore give profiles their own id and map auth users via
-- `profiles.user_id` (parents) and `device_registrations` (kids). See docs/ARCHITECTURE.md.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------
create table if not exists families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (parents + kids)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null, -- parent auth user; null for kids
  name          text not null,
  emoji         text,
  color         text,
  role          text not null check (role in ('parent','kid')),
  mode          text not null default 'points' check (mode in ('points','stickers')),
  bank          numeric not null default 0,
  week          numeric not null default 0,
  week_deducted numeric not null default 0,
  clean_days    int not null default 0,
  quality_streak int not null default 0,
  stickers      int not null default 0,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists profiles_family_idx on profiles(family_id);
create index if not exists profiles_user_idx   on profiles(user_id);

-- ---------------------------------------------------------------------------
-- device_registrations: binds an anonymous auth user (a kid's device) to a kid
-- profile once a parent approves it.
-- ---------------------------------------------------------------------------
create table if not exists device_registrations (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  kid_id       uuid not null references profiles(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  approved     boolean not null default false,
  device_label text,
  created_at   timestamptz not null default now(),
  unique(auth_user_id)
);
create index if not exists device_reg_family_idx on device_registrations(family_id);

-- ---------------------------------------------------------------------------
-- chores  (base_pts, freq; `active` is the "armed" flag for ondemand hotspots)
-- ---------------------------------------------------------------------------
create table if not exists chores (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  emoji      text,
  title      text not null,
  base_pts   numeric not null,
  freq       text not null check (freq in ('twice_daily','daily','weekly','biweekly','ondemand')),
  active     boolean not null default true, -- ondemand: armed? non-ondemand: always listed
  sort       int not null default 0,
  deleted_at timestamptz
);
create index if not exists chores_family_idx on chores(family_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- completions (claims). Snapshots freeze title/points at claim time.
-- ---------------------------------------------------------------------------
create table if not exists completions (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  chore_id       uuid not null references chores(id) on delete cascade,
  kid_id         uuid not null references profiles(id) on delete cascade,
  title_snapshot text not null,
  pts_snapshot   numeric not null,
  occurred_on    date not null,
  week_key       text not null,
  status         text not null default 'pending' check (status in ('pending','rated')),
  stars          int not null default 0 check (stars between 0 and 3),
  earned         numeric not null default 0,
  rated_by       uuid references profiles(id),
  created_at     timestamptz not null default now()
);
create index if not exists completions_family_idx on completions(family_id);
create index if not exists completions_chore_period_idx on completions(chore_id, occurred_on, week_key);
create index if not exists completions_kid_day_idx on completions(kid_id, occurred_on);
create index if not exists completions_status_idx on completions(family_id, status);

-- ---------------------------------------------------------------------------
-- deductions
-- ---------------------------------------------------------------------------
create table if not exists deduction_rules (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  title      text not null,
  pts        numeric not null,
  deleted_at timestamptz
);
create index if not exists deduction_rules_family_idx on deduction_rules(family_id) where deleted_at is null;

create table if not exists deduction_events (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  rule_id     uuid references deduction_rules(id),
  occurred_on date not null,
  week_key    text not null,
  amounts     jsonb not null default '{}'::jsonb, -- {kid_id: actual_hit}
  created_at  timestamptz not null default now()
);
create index if not exists deduction_events_family_idx on deduction_events(family_id);

-- ---------------------------------------------------------------------------
-- room checks (one per family per day)
-- ---------------------------------------------------------------------------
create table if not exists room_checks (
  family_id   uuid not null references families(id) on delete cascade,
  occurred_on date not null,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  primary key (family_id, occurred_on)
);

-- ---------------------------------------------------------------------------
-- rewards catalog
-- ---------------------------------------------------------------------------
create table if not exists rewards (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  title      text not null,
  cost_pts   numeric not null,
  type       text not null check (type in ('spend','goal')),
  note       text,
  sort       int not null default 0,
  deleted_at timestamptz
);
create index if not exists rewards_family_idx on rewards(family_id) where deleted_at is null;

create table if not exists ellie_rewards (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  title      text not null,
  stickers   int not null,
  sort       int not null default 0,
  deleted_at timestamptz
);
create index if not exists ellie_rewards_family_idx on ellie_rewards(family_id) where deleted_at is null;

create table if not exists redemptions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  kid_id      uuid not null references profiles(id) on delete cascade,
  title       text not null,
  cost        text not null,           -- "20" pts, or "10 stickers" (matches prototype)
  occurred_on date not null,
  created_at  timestamptz not null default now()
);
create index if not exists redemptions_kid_idx on redemptions(kid_id);

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table if not exists goals (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  kid_id     uuid not null references profiles(id) on delete cascade,
  title      text not null,
  target     numeric not null,
  saved      numeric not null default 0,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists goals_kid_idx on goals(kid_id) where done = false;

-- ---------------------------------------------------------------------------
-- sticker events (audit trail for Ellie)
-- ---------------------------------------------------------------------------
create table if not exists sticker_events (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  kid_id      uuid not null references profiles(id) on delete cascade,
  delta       int not null,
  occurred_on date not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- checkins (one per kid per day)
-- ---------------------------------------------------------------------------
create table if not exists checkins (
  family_id   uuid not null references families(id) on delete cascade,
  kid_id      uuid not null references profiles(id) on delete cascade,
  occurred_on date not null,
  created_at  timestamptz not null default now(),
  primary key (kid_id, occurred_on)
);

-- ---------------------------------------------------------------------------
-- settings (per family)
-- ---------------------------------------------------------------------------
create table if not exists settings (
  family_id             uuid primary key references families(id) on delete cascade,
  point_value           numeric not null default 0.25,
  mult                  numeric[] not null default '{0.5,1,1.5}',
  personal_streak_days  int not null default 7,
  personal_streak_bonus numeric not null default 5,
  quality_streak_len    int not null default 5,
  quality_streak_bonus  numeric not null default 3,
  weekly_deduction_cap  numeric not null default 6,
  cartoon_minutes       int not null default 30
);

-- ---------------------------------------------------------------------------
-- tally_runs: idempotency guard for the Sunday tally (one payout per week_key)
-- ---------------------------------------------------------------------------
create table if not exists tally_runs (
  family_id  uuid not null references families(id) on delete cascade,
  week_key   text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (family_id, week_key)
);
