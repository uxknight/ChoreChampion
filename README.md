# Chore Champions

Production port of the single-file prototype (`chore-champions.html`) — a family
chores/points/rewards app. **Next.js 16 (App Router, TypeScript) + Supabase
(Postgres, Auth, RLS, Realtime) + Tailwind**, mobile-first, installable PWA.

The prototype remains the authoritative reference for UI, copy, mechanics, and math.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design (incl. the documented
deviation from brief B3's `profiles(id references auth.users)`).

## Prerequisites
- Node 20+
- A container runtime (Colima or Docker Desktop) for local Supabase
- Supabase CLI (`brew install supabase/tap/supabase`)

## Local setup
```bash
npm install
supabase start          # boots Postgres/Auth/PostgREST/Realtime locally
npm run db:reset        # applies migrations + seeds the Knight family
# copy the values from `supabase status` into .env.local (see .env.example)
npm run dev             # http://localhost:3000
```

Seeded logins for local dev:
- **Parent:** `parent@knight.test` / `password123`
- **Kids:** Vera / Slavia / Ellie (devices pre-approved in the seed)

## Auth model
- **Parents** sign in with email/password. A parent creates the family (`create_family`)
  and gets a 6-char invite code.
- **Kids** have no email: on their own device they enter the family code, tap their
  avatar (anonymous session), and a parent approves the device in **Admin → Device
  approvals**. On a shared tablet, a signed-in parent can act for the selected kid.

## Business rules
Every point-bearing mutation is a Postgres `SECURITY DEFINER` RPC (see
`supabase/migrations/*_rpcs.sql`). Clients may only `SELECT` within their family;
parents additionally write the catalog tables directly (RLS-gated). Timezone is
**America/Los_Angeles**, ISO weeks start **Monday**, biweekly = **even ISO weeks**.

## Tests
```bash
npm run test:db     # resets the DB, runs the B9 acceptance suite (37 assertions)
```
Covers claim limits, star math + streak bonus, deduction floor/cap/bank-safety,
clean-streak bonus, hotspot lifecycle, tally idempotency (manual + cron paths),
cartoon states, goal clamping, and RLS denial for kid sessions.

## Sunday tally (cron)
`GET /api/cron/tally` (guarded by `CRON_SECRET`) runs the idempotent weekly tally
for every family. `vercel.json` schedules it Monday 03:00 UTC (≈ Sunday evening PT).
A parent can also run it from **Admin → Sunday tally**.

## Migrating from the prototype
Export the prototype's data (Admin → Export backup) and import it:
```bash
node scripts/import-prototype.mjs --file backup.json --family KNIGHT --dry   # preview
node scripts/import-prototype.mjs --file backup.json --family KNIGHT         # apply
```
Carries over per-kid bank/week/streaks/stickers, goals, redemptions, the current
week's rated scorecard, and today's check-ins — no earned points lost.

## Deploy (Vercel + Supabase)
1. Push to `github.com/uxknight/ChoreChampion`.
2. Create a hosted Supabase project; run `supabase db push` (or apply
   `supabase/migrations` + `seed`). Enable anonymous sign-ins in Auth settings.
3. In Vercel, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET`. The cron is configured in `vercel.json`.
