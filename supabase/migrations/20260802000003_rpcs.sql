-- Chore Champions — Phase 2: business-logic RPCs (SECURITY DEFINER).
-- All point math is server-side so multipliers, caps and bonuses cannot be
-- manipulated from the client. Ported verbatim from the prototype.

-- ===========================================================================
-- FAMILY / ONBOARDING
-- ===========================================================================

-- Create a family for the currently signed-in parent (email/password user).
create or replace function create_family(
  p_family_name text,
  p_parent_name text,
  p_parent_emoji text default '👑',
  p_parent_color text default '#7c5cff'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; code text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from profiles where user_id = auth.uid()) then
    raise exception 'already_in_family';
  end if;
  code := gen_invite_code();
  insert into families(name, invite_code) values (p_family_name, code) returning id into fam;
  perform seed_family(fam);
  insert into profiles(family_id, user_id, name, emoji, color, role, mode)
    values (fam, auth.uid(), p_parent_name, p_parent_emoji, p_parent_color, 'parent', 'points');
  return jsonb_build_object('family_id', fam, 'invite_code', code);
end;
$$;

-- Parent adds a kid profile.
create or replace function add_kid(
  p_name text, p_emoji text, p_color text default '#7c5cff', p_mode text default 'points'
) returns profiles language plpgsql security definer set search_path = public as $$
declare fam uuid; r profiles;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  insert into profiles(family_id, name, emoji, color, role, mode, sort)
    values (fam, p_name, p_emoji, p_color, 'kid', p_mode,
            coalesce((select max(sort)+1 from profiles where family_id = fam and role='kid'), 0))
    returning * into r;
  return r;
end;
$$;

-- Public: list a family's kids by invite code (for the kid device picker).
create or replace function family_kids(p_invite_code text)
returns table(id uuid, name text, emoji text, color text, mode text)
language sql security definer set search_path = public as $$
  select p.id, p.name, p.emoji, p.color, p.mode
    from profiles p join families f on f.id = p.family_id
   where f.invite_code = upper(p_invite_code) and p.role = 'kid'
   order by p.sort;
$$;

-- A kid device (anonymous auth user) requests to bind to a kid profile.
create or replace function request_device(p_invite_code text, p_kid_id uuid, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select f.id into fam from families f where f.invite_code = upper(p_invite_code);
  if fam is null then raise exception 'bad_invite_code'; end if;
  if not exists (select 1 from profiles where id = p_kid_id and family_id = fam and role='kid') then
    raise exception 'bad_kid'; end if;
  insert into device_registrations(family_id, kid_id, auth_user_id, device_label, approved)
    values (fam, p_kid_id, auth.uid(), p_label, false)
    on conflict (auth_user_id) do update set kid_id = excluded.kid_id, approved = false;
  return jsonb_build_object('family_id', fam, 'kid_id', p_kid_id, 'approved', false);
end;
$$;

-- Parent approves (or revokes) a device.
create or replace function approve_device(p_device_id uuid, p_approved boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  update device_registrations set approved = p_approved
   where id = p_device_id and family_id = current_family_id();
end;
$$;

-- ===========================================================================
-- KID ACTIONS
-- ===========================================================================

create or replace function check_in()
returns void language plpgsql security definer set search_path = public as $$
declare kid uuid; fam uuid;
begin
  kid := current_kid_id();
  if kid is null then raise exception 'kid_only'; end if;
  fam := current_family_id();
  insert into checkins(family_id, kid_id, occurred_on)
    values (fam, kid, app_today())
    on conflict (kid_id, occurred_on) do nothing;
end;
$$;

-- Claim (complete) a chore — household-wide first-come-first-served, pending review.
create or replace function claim_chore(p_chore_id uuid)
returns completions language plpgsql security definer set search_path = public as $$
declare kid uuid; fam uuid; ch chores; used int; lim int; r completions;
begin
  kid := current_kid_id();
  if kid is null then raise exception 'kid_only'; end if;
  fam := current_family_id();

  select * into ch from chores where id = p_chore_id and family_id = fam and deleted_at is null;
  if ch.id is null then raise exception 'no_chore'; end if;

  -- active-this-week gates (server-authoritative)
  if ch.freq = 'ondemand' and not ch.active then raise exception 'hotspot_not_active'; end if;
  if ch.freq = 'biweekly' and not is_biweekly_on() then raise exception 'not_biweekly_week'; end if;

  -- current-period completion count, household-wide
  select count(*) into used from completions c
   where c.chore_id = ch.id
     and case
           when ch.freq in ('twice_daily','daily','ondemand') then c.occurred_on = app_today()
           when ch.freq = 'weekly'   then c.week_key = app_week_key()
           when ch.freq = 'biweekly' then c.week_key in (app_week_key(), prev_week_key())
         end;
  lim := case when ch.freq = 'twice_daily' then 2 else 1 end;
  if used >= lim then raise exception 'chore_period_full'; end if;

  insert into completions(family_id, chore_id, kid_id, title_snapshot, pts_snapshot,
                          occurred_on, week_key, status, stars, earned)
    values (fam, ch.id, kid,
            case when ch.emoji is not null then ch.emoji || ' ' else '' end || ch.title,
            ch.base_pts, app_today(), app_week_key(), 'pending', 0, 0)
    returning * into r;

  if ch.freq = 'ondemand' then
    update chores set active = false where id = ch.id;
  end if;
  return r;
end;
$$;

-- ===========================================================================
-- PARENT ACTIONS
-- ===========================================================================

-- Rate a pending completion. earned = round_half(base * mult[stars]).
create or replace function rate_completion(p_completion_id uuid, p_stars int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; e completions; s settings; kid profiles;
        v_earned numeric; v_bonus numeric := 0;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  if p_stars not between 1 and 3 then raise exception 'bad_stars'; end if;
  fam := current_family_id();

  select * into e from completions where id = p_completion_id and family_id = fam;
  if e.id is null then raise exception 'no_completion'; end if;
  if e.status = 'rated' then raise exception 'already_rated'; end if;

  select * into s from settings where family_id = fam;
  v_earned := round_half(e.pts_snapshot * s.mult[p_stars]);

  update completions
     set status = 'rated', stars = p_stars, earned = v_earned,
         rated_by = (select id from profiles where user_id = auth.uid() and family_id = fam limit 1)
   where id = e.id;

  select * into kid from profiles where id = e.kid_id;
  update profiles set week = round_half(week + v_earned) where id = kid.id;

  if p_stars = 3 then
    update profiles set quality_streak = quality_streak + 1 where id = kid.id
      returning quality_streak into kid.quality_streak;
    if kid.quality_streak >= s.quality_streak_len then
      v_bonus := s.quality_streak_bonus;
      update profiles set week = round_half(week + v_bonus), quality_streak = 0 where id = kid.id;
    end if;
  else
    update profiles set quality_streak = 0 where id = kid.id;
  end if;

  return jsonb_build_object('earned', v_earned, 'stars', p_stars,
                            'streak_bonus', v_bonus, 'kid_id', kid.id);
end;
$$;

-- Apply a deduction to every points-mode kid (shared-pool / Hogwarts rule).
create or replace function apply_deduction(p_rule_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; d deduction_rules; cap numeric; k record; hit numeric; room numeric;
        amounts jsonb := '{}'::jsonb;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  select * into d from deduction_rules where id = p_rule_id and family_id = fam and deleted_at is null;
  if d.id is null then raise exception 'no_rule'; end if;
  select weekly_deduction_cap into cap from settings where family_id = fam;

  for k in select * from profiles where family_id = fam and role='kid' and mode='points' loop
    room := greatest(0, cap - k.week_deducted);
    hit  := least(d.pts, room, k.week);
    update profiles
       set week = round_half(week - hit),
           week_deducted = round_half(week_deducted + hit),
           clean_days = 0
     where id = k.id;
    amounts := amounts || jsonb_build_object(k.id::text, hit);
  end loop;

  insert into deduction_events(family_id, rule_id, occurred_on, week_key, amounts)
    values (fam, d.id, app_today(), app_week_key(), amounts);
  return amounts;
end;
$$;

-- Daily room check (one per family per day). Increments clean streaks.
create or replace function room_check()
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; s settings; k record; bonus boolean := false; v_bonus numeric := 0;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  begin
    insert into room_checks(family_id, occurred_on, created_by)
      values (fam, app_today(),
              (select id from profiles where user_id = auth.uid() and family_id = fam limit 1));
  exception when unique_violation then
    raise exception 'room_check_done';
  end;

  select * into s from settings where family_id = fam;
  for k in select * from profiles where family_id = fam and role='kid' and mode='points' loop
    if (k.clean_days + 1) >= s.personal_streak_days then
      update profiles set week = round_half(week + s.personal_streak_bonus), clean_days = 0
        where id = k.id;
      bonus := true; v_bonus := s.personal_streak_bonus;
    else
      update profiles set clean_days = clean_days + 1 where id = k.id;
    end if;
  end loop;
  return jsonb_build_object('bonus', bonus, 'bonus_pts', v_bonus);
end;
$$;

-- Internal tally: week -> bank for every points-kid, idempotent per week_key.
-- Restricted to service_role (used by the cron); parents go through run_tally().
create or replace function _tally(fam uuid, wk text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_wk text := coalesce(wk, app_week_key());
begin
  begin
    insert into tally_runs(family_id, week_key) values (fam, v_wk);
  exception when unique_violation then
    return jsonb_build_object('ran', false, 'week_key', v_wk);
  end;
  update profiles set bank = round_half(bank + week), week = 0, week_deducted = 0
    where family_id = fam and role='kid' and mode='points';
  return jsonb_build_object('ran', true, 'week_key', v_wk);
end;
$$;

-- Parent-facing tally.
create or replace function run_tally()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  return _tally(current_family_id(), app_week_key());
end;
$$;

-- Toggle a hotspot's armed flag.
create or replace function toggle_hotspot(p_chore_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare fam uuid; v boolean;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  update chores set active = not active
    where id = p_chore_id and family_id = fam and freq = 'ondemand' and deleted_at is null
    returning active into v;
  if v is null then raise exception 'no_hotspot'; end if;
  return v;
end;
$$;

-- ===========================================================================
-- REWARDS / GOALS / STICKERS
-- ===========================================================================

create or replace function redeem_reward(p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; kid uuid; r rewards; bal numeric;
begin
  kid := current_kid_id();
  if kid is null then raise exception 'kid_only'; end if;
  fam := current_family_id();
  select * into r from rewards where id = p_reward_id and family_id = fam and deleted_at is null;
  if r.id is null then raise exception 'no_reward'; end if;
  select bank into bal from profiles where id = kid;
  if bal < r.cost_pts then raise exception 'insufficient_bank'; end if;
  update profiles set bank = round_half(bank - r.cost_pts) where id = kid;
  insert into redemptions(family_id, kid_id, title, cost, occurred_on)
    values (fam, kid, r.title, r.cost_pts::text, app_today());
  return jsonb_build_object('title', r.title, 'cost', r.cost_pts);
end;
$$;

create or replace function start_goal(p_reward_id uuid)
returns goals language plpgsql security definer set search_path = public as $$
declare fam uuid; kid uuid; r rewards; g goals;
begin
  kid := current_kid_id();
  if kid is null then raise exception 'kid_only'; end if;
  fam := current_family_id();
  select * into r from rewards where id = p_reward_id and family_id = fam and deleted_at is null;
  if r.id is null then raise exception 'no_reward'; end if;
  if exists (select 1 from goals where kid_id = kid and title = r.title and not done) then
    raise exception 'goal_exists';
  end if;
  insert into goals(family_id, kid_id, title, target, saved, done)
    values (fam, kid, r.title, r.cost_pts, 0, false) returning * into g;
  return g;
end;
$$;

create or replace function allocate_to_goal(p_goal_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; g goals; bal numeric; real numeric;
begin
  fam := current_family_id();
  select * into g from goals where id = p_goal_id and family_id = fam and not done;
  if g.id is null then raise exception 'no_goal'; end if;
  -- kid may only fund their own goal; parents may fund any in the family
  if not is_parent() and current_kid_id() is distinct from g.kid_id then
    raise exception 'not_your_goal';
  end if;
  select bank into bal from profiles where id = g.kid_id;
  real := least(p_amount, bal, g.target - g.saved);
  if real <= 0 then raise exception 'nothing_to_add'; end if;
  update profiles set bank = round_half(bank - real) where id = g.kid_id;
  update goals set saved = round_half(saved + real) where id = g.id returning saved into g.saved;
  return jsonb_build_object('added', real, 'saved', g.saved, 'target', g.target,
                            'reached', g.saved >= g.target);
end;
$$;

create or replace function finish_goal(p_goal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare fam uuid; g goals;
begin
  fam := current_family_id();
  select * into g from goals where id = p_goal_id and family_id = fam and not done;
  if g.id is null then raise exception 'no_goal'; end if;
  if not is_parent() and current_kid_id() is distinct from g.kid_id then
    raise exception 'not_your_goal';
  end if;
  update goals set done = true where id = g.id;
  insert into redemptions(family_id, kid_id, title, cost, occurred_on)
    values (fam, g.kid_id, g.title, g.target::text, app_today());
end;
$$;

-- Ellie stickers: adds are parent-gated.
create or replace function add_sticker(p_kid_id uuid, p_delta int default 1)
returns int language plpgsql security definer set search_path = public as $$
declare fam uuid; total int;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  if not exists (select 1 from profiles where id = p_kid_id and family_id = fam and mode='stickers') then
    raise exception 'not_sticker_kid';
  end if;
  update profiles set stickers = greatest(0, stickers + p_delta) where id = p_kid_id
    returning stickers into total;
  insert into sticker_events(family_id, kid_id, delta, occurred_on)
    values (fam, p_kid_id, p_delta, app_today());
  return total;
end;
$$;

create or replace function redeem_ellie(p_reward_id uuid, p_kid_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; r ellie_rewards; have int;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  select * into r from ellie_rewards where id = p_reward_id and family_id = fam and deleted_at is null;
  if r.id is null then raise exception 'no_reward'; end if;
  select stickers into have from profiles where id = p_kid_id and family_id = fam;
  if have < r.stickers then raise exception 'insufficient_stickers'; end if;
  update profiles set stickers = stickers - r.stickers where id = p_kid_id;
  insert into sticker_events(family_id, kid_id, delta, occurred_on)
    values (fam, p_kid_id, -r.stickers, app_today());
  insert into redemptions(family_id, kid_id, title, cost, occurred_on)
    values (fam, p_kid_id, r.title, r.stickers::text || ' stickers', app_today());
  return jsonb_build_object('title', r.title, 'stickers', r.stickers);
end;
$$;

-- Lock down the service-only tally entrypoint.
revoke execute on function _tally(uuid, text) from public, anon, authenticated;
grant execute on function _tally(uuid, text) to service_role;
