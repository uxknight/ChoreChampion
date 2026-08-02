# Chore Champions — Architecture notes

Production port of the single-file prototype (`chore-champions.html`). The prototype
remains the authoritative reference for UI, copy, mechanics, and math.

## Stack
- **Next.js (App Router, TypeScript)** on Vercel, Tailwind, mobile-first (max-width 560px), PWA.
- **Supabase**: Postgres + Auth + RLS + Realtime. Local dev via the Supabase CLI on Colima.
- Timezone **America/Los_Angeles**; ISO weeks start Monday; biweekly chores live on **even ISO weeks**.

## Where the rules live
Every point-bearing mutation is a Postgres `SECURITY DEFINER` RPC (`supabase/migrations/…_rpcs.sql`),
so multipliers, caps, streaks, and the tally cannot be manipulated from the client. Clients may only
`SELECT` within their family; the only direct client writes allowed by RLS are parent edits to the
**catalog** tables (chores/deductions/rewards/ellie_rewards/settings), which carry no point math.

`round_half(x) = round(x*2)/2` is the single rounding primitive, matching the prototype's `half()`.

## Deviation from BUILD BRIEF B3 (documented on purpose)
The brief writes `profiles(id uuid pk references auth.users)`. That does not fit the brief's **own**
kid model (B2): kid profiles pre-exist, a kid has **no email**, and **multiple parent-approved
devices** (each its own anonymous auth user) can bind to one kid. A 1:1 `profiles.id = auth.users.id`
cannot represent "profile created before any device" or "several devices → one kid".

**Resolution:** profile identity is independent of auth identity.
- `profiles.user_id` → the parent's `auth.users` row (null for kids).
- `device_registrations(kid_id, auth_user_id, approved)` binds each kid **device** (an anonymous
  auth user) to a kid profile, gated by parent approval.
- `current_family_id()`, `is_parent()`, `current_kid_id()` are `SECURITY DEFINER` helpers that resolve
  the caller from `auth.uid()` via those two tables and drive every RLS policy and RPC role check.

Everything else in B3 is implemented as written (soft-delete on catalog rows, `*_snapshot` on
completions, the `settings` shape, `tally_runs` idempotency guard, etc.).

## Auth flows
- **Parent**: Supabase email/password → `create_family()` seeds the catalog + parent profile, or joins none.
- **Kid device**: anonymous Supabase session → `request_device(invite_code, kid_id)` (pending) →
  parent calls `approve_device()` → the device's `auth.uid()` now resolves to that kid.

## Tally / cron
`run_tally()` is parent-callable; `_tally(family, week_key)` is service-role only and is what the
Vercel Cron (Sun 19:00 PT) calls. Both are idempotent per `(family_id, week_key)`.

## Tests
`supabase/tests/acceptance.sql` replicates every B9 case as SQL assertions (impersonating kid/parent
sessions via JWT claims, and switching to the `authenticated` role for RLS-denial checks).
Run with `./supabase/tests/run.sh` (resets the DB to the seed baseline first).
