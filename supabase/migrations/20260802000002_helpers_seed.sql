-- Chore Champions — Phase 1/2: helper functions, auth context, per-family seed.

-- ---------------------------------------------------------------------------
-- Math + time helpers (America/Los_Angeles, ISO weeks starting Monday)
-- ---------------------------------------------------------------------------

-- round half away from zero, to nearest 0.5  (prototype: half(x)=round(x*2)/2)
create or replace function round_half(x numeric)
returns numeric language sql immutable as $$
  select round(x * 2) / 2;
$$;

create or replace function app_today()
returns date language sql stable as $$
  select (now() at time zone 'America/Los_Angeles')::date;
$$;

-- "YYYY-Www" using ISO year + zero-padded ISO week (e.g. 2026-W32)
create or replace function iso_week_key(d date)
returns text language sql immutable as $$
  select to_char(d, 'IYYY') || '-W' || to_char(d, 'IW');
$$;

create or replace function app_week_key()
returns text language sql stable as $$
  select iso_week_key(app_today());
$$;

create or replace function prev_week_key()
returns text language sql stable as $$
  select iso_week_key(app_today() - 7);
$$;

-- biweekly chores are live on even ISO weeks (prototype: isoWeek % 2 === 0)
create or replace function is_biweekly_on()
returns boolean language sql stable as $$
  select (to_char(app_today(), 'IW')::int % 2) = 0;
$$;

-- ---------------------------------------------------------------------------
-- Auth context helpers (SECURITY DEFINER so RLS policies can call them without
-- recursing on profiles / device_registrations).
-- ---------------------------------------------------------------------------
create or replace function current_family_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.family_id from profiles p
       where p.user_id = auth.uid() and p.role = 'parent' limit 1),
    (select d.family_id from device_registrations d
       where d.auth_user_id = auth.uid() and d.approved limit 1)
  );
$$;

create or replace function is_parent()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
     where p.user_id = auth.uid() and p.role = 'parent'
  );
$$;

-- the kid profile bound to the current (approved) device session, if any
create or replace function current_kid_id()
returns uuid language sql stable security definer set search_path = public as $$
  select d.kid_id from device_registrations d
   where d.auth_user_id = auth.uid() and d.approved
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Invite-code generator (6 unambiguous chars)
-- ---------------------------------------------------------------------------
create or replace function gen_invite_code()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from families where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- seed_family: inserts the prototype DEFAULT catalog + settings for a family.
-- Idempotent-ish: only seeds when the family has no chores yet.
-- ---------------------------------------------------------------------------
create or replace function seed_family(fam uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from chores where family_id = fam) then
    return;
  end if;

  insert into settings(family_id) values (fam)
    on conflict (family_id) do nothing;

  -- Chores (emoji, title, base_pts, freq, active, sort) — exact prototype DEFAULT
  insert into chores(family_id, emoji, title, base_pts, freq, active, sort) values
    (fam, '🍽️', 'Put clean dishes away',                              1, 'twice_daily', true,  1),
    (fam, '🫧', 'Put dirty dishes in the dishwasher',                  1, 'twice_daily', true,  2),
    (fam, '🧹', 'Sweep the kitchen floor',                             1, 'twice_daily', true,  3),
    (fam, '🧽', 'Clean surfaces, countertops & stove',                 2, 'twice_daily', true,  4),
    (fam, '👶', 'Clean Nikolina’s chair',                              1, 'twice_daily', true,  5),
    (fam, '🪣', 'Wash the kitchen floors',                             3, 'weekly',      true,  6),
    (fam, '✨', 'Wash stainless steel (fridge, stove, dishwasher)',    2, 'weekly',      true,  7),
    (fam, '🚽', 'Clean bathroom #1 (toilet, sink, mirror, floor, shelf)', 3, 'weekly',   true,  8),
    (fam, '🛁', 'Clean bathroom #2 (toilet, sink, mirror, floor, shelf)', 3, 'weekly',   true,  9),
    (fam, '🪜', 'Vacuum the stairs',                                   2, 'weekly',      true, 10),
    (fam, '🌀', 'Vacuum second floor (3 rooms + hallway)',             3, 'weekly',      true, 11),
    (fam, '🚗', 'Clear out the car',                                   3, 'biweekly',    true, 12),
    (fam, '🧻', 'Fold towels & distribute',                            2, 'biweekly',    true, 13),
    (fam, '🚪', 'Hotspot: reset the entryway',                         1, 'ondemand',    false,14),
    (fam, '🧰', 'Hotspot: reset the garage',                           2, 'ondemand',    false,15);

  -- Deduction rules
  insert into deduction_rules(family_id, title, pts) values
    (fam, 'Room / personal stuff not picked up at day-end check', 2),
    (fam, 'Personal laundry not done by Sunday dinner',           3),
    (fam, 'Bed not made / backpack not put away',                 1);

  -- Rewards
  insert into rewards(family_id, title, cost_pts, type, note, sort) values
    (fam, 'Piggy bank cash',                  20,  'spend', 'Cold hard cash for your piggy bank.', 1),
    (fam, 'Temu order',                       40,  'spend', 'Pick something out — orders ship monthly.', 2),
    (fam, 'Play date + snack stipend',        40,  'spend', 'Invite a friend, $10 for snacks or an activity.', 3),
    (fam, 'Dad outing (25% budget bonus!)',   60,  'spend', 'You pick the place. Budget = points value + 25% extra.', 4),
    (fam, 'Hopscotch Portland trip',          60,  'spend', 'Immersive art adventure. Ellie gets in free!', 5),
    (fam, 'Sky Zone monthly membership',      110, 'goal',  'Big goal! Also needs two straight ★★★-quality weeks.', 6),
    (fam, 'Hawaii travel fund 🌺 (50% parent match)', 400, 'goal', 'Every point you save, parents add half again on top.', 7);

  -- Ellie sticker rewards
  insert into ellie_rewards(family_id, title, stickers, sort) values
    (fam, 'Dollar-store toy pick',   10, 1),
    (fam, 'Extra bedtime story',     10, 2),
    (fam, 'Choose the family movie', 10, 3);
end;
$$;
