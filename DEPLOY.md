# Deploying Chore Champions

Local dev already works (see [README](README.md)). This is the one-time path to a
public, multi-device deployment on **GitHub → Supabase (hosted) → Vercel**.

Steps marked **[you]** need your accounts/credentials; the rest is already prepared
in this repo.

---

## 1. Push to GitHub  **[you]**

The `origin` remote is already set to `https://github.com/uxknight/ChoreChampion`.

```bash
git push -u origin main
```

If the remote repo doesn't exist yet, create an empty one at that URL first (no
README/license, so history stays clean), then run the push.

---

## 2. Hosted Supabase project

### 2a. Create the project  **[you]**
- In the Supabase dashboard, create a new project. Pick a region near you
  (e.g. `us-west-1`). Save the **database password**.
- Grab the **project ref** (the `abcdefgh...` in the project URL).

### 2b. Link + push the schema
```bash
supabase login                       # [you] opens a browser
supabase link --project-ref <PROJECT_REF>
supabase db push                     # applies supabase/migrations/* to the hosted DB
```

> `db push` applies **migrations only**. It does **not** run `supabase/seed.sql`
> (that file is a local test fixture — the fake "Knight family" and its logins
> never reach production). Real families are created in-app: when a parent signs
> up and creates a family, the `create_family` RPC seeds that family's default
> chores/rewards/deductions/settings via `seed_family`.
>
> ⚠️ Never run `supabase db reset` against the linked project — that is destructive.

### 2c. Enable anonymous sign-ins  **[you]**
Kid devices use anonymous auth. In the dashboard:
**Authentication → Sign In / Providers → Anonymous sign-ins → Enable.**
(Parents use email/password, which is on by default.)

### 2d. Realtime
The `20260802000008_realtime.sql` migration already adds `completions`, `profiles`,
and `device_registrations` to the `supabase_realtime` publication, so realtime works
after `db push` with no extra clicks.

### 2e. Copy the keys  **[you]**
From **Project Settings → API**:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC`)

---

## 3. Deploy to Vercel  **[you]**

1. In Vercel, **Import** the `uxknight/ChoreChampion` GitHub repo (Vercel auto-detects Next.js).
2. Add **Environment Variables** (Production + Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role secret |
   | `CRON_SECRET` | any long random string |

   > `NEXT_PUBLIC_*` are inlined at build time, so set them **before** the first deploy.
3. Deploy. The Sunday-tally cron is already declared in `vercel.json`
   (`GET /api/cron/tally`, Monday 03:00 UTC ≈ Sunday evening PT). Vercel injects the
   `Authorization: Bearer $CRON_SECRET` header; the route rejects anything else.

---

## 4. First run

1. Open the deployed URL → **I'm a parent → Create account** → create your family.
   You'll get a 6-character **family code**.
2. **Admin → 🧹 Paid chores / 🎁 Rewards / ⚙️ Settings** — the defaults are seeded;
   adjust point value, chores, and rewards to taste. Add your kids under Admin.
3. On each kid's device: **I'm a kid → enter the family code → tap their avatar**,
   then approve the device from **Admin → 📱 Device approvals** on your phone.
4. Optional: to carry over data from the prototype, export its backup and run the
   importer against the hosted DB (see README → "Migrating from the prototype").

---

## Notes
- **Cron & DST:** cron times are UTC and don't shift with DST. The weekly tally is
  idempotent (guarded per `family_id + week_key`) and also runnable from
  **Admin → Sunday tally**, so a one-hour DST drift is harmless.
- **Schema changes later:** add a new file under `supabase/migrations/`, test locally
  with `npm run db:reset` + `npm run test:db`, then `supabase db push` to promote.
