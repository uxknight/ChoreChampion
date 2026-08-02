-- Chore Champions — "acting kid" resolver so the shared-device (parent) flow and
-- the per-device kid flow share one code path.
--   * kid session  -> the actor is always the kid bound to the device (param ignored)
--   * parent session -> the actor is the explicitly-passed kid (must be in family)
-- This preserves the prototype's shared-tablet UX without weakening kid-session RLS.

create or replace function _actor_kid(p_kid_id uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare fam uuid; k uuid;
begin
  fam := current_family_id();
  if is_parent() then
    if p_kid_id is null then raise exception 'kid_required'; end if;
    if not exists (select 1 from profiles where id = p_kid_id and family_id = fam and role = 'kid') then
      raise exception 'bad_kid';
    end if;
    return p_kid_id;
  end if;
  k := current_kid_id();
  if k is null then raise exception 'kid_only'; end if;
  return k;
end $$;

-- ---- check_in(p_kid_id default null) ------------------------------------
drop function if exists check_in();
create or replace function check_in(p_kid_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare kid uuid;
begin
  kid := _actor_kid(p_kid_id);
  insert into checkins(family_id, kid_id, occurred_on)
    values (current_family_id(), kid, app_today())
    on conflict (kid_id, occurred_on) do nothing;
end $$;

-- ---- claim_chore(p_chore_id, p_kid_id default null) ---------------------
drop function if exists claim_chore(uuid);
create or replace function claim_chore(p_chore_id uuid, p_kid_id uuid default null)
returns completions language plpgsql security definer set search_path = public as $$
declare kid uuid; fam uuid; ch chores; used int; lim int; r completions;
begin
  fam := current_family_id();
  kid := _actor_kid(p_kid_id);

  select * into ch from chores where id = p_chore_id and family_id = fam and deleted_at is null;
  if ch.id is null then raise exception 'no_chore'; end if;
  if ch.freq = 'ondemand' and not ch.active then raise exception 'hotspot_not_active'; end if;
  if ch.freq = 'biweekly' and not is_biweekly_on() then raise exception 'not_biweekly_week'; end if;

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

  if ch.freq = 'ondemand' then update chores set active = false where id = ch.id; end if;
  return r;
end $$;

-- ---- redeem_reward(p_reward_id, p_kid_id default null) ------------------
drop function if exists redeem_reward(uuid);
create or replace function redeem_reward(p_reward_id uuid, p_kid_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; kid uuid; r rewards; bal numeric;
begin
  fam := current_family_id();
  kid := _actor_kid(p_kid_id);
  select * into r from rewards where id = p_reward_id and family_id = fam and deleted_at is null;
  if r.id is null then raise exception 'no_reward'; end if;
  select bank into bal from profiles where id = kid;
  if bal < r.cost_pts then raise exception 'insufficient_bank'; end if;
  update profiles set bank = round_half(bank - r.cost_pts) where id = kid;
  insert into redemptions(family_id, kid_id, title, cost, occurred_on)
    values (fam, kid, r.title, r.cost_pts::text, app_today());
  return jsonb_build_object('title', r.title, 'cost', r.cost_pts);
end $$;

-- ---- start_goal(p_reward_id, p_kid_id default null) --------------------
drop function if exists start_goal(uuid);
create or replace function start_goal(p_reward_id uuid, p_kid_id uuid default null)
returns goals language plpgsql security definer set search_path = public as $$
declare fam uuid; kid uuid; r rewards; g goals;
begin
  fam := current_family_id();
  kid := _actor_kid(p_kid_id);
  select * into r from rewards where id = p_reward_id and family_id = fam and deleted_at is null;
  if r.id is null then raise exception 'no_reward'; end if;
  if exists (select 1 from goals where kid_id = kid and title = r.title and not done) then
    raise exception 'goal_exists';
  end if;
  insert into goals(family_id, kid_id, title, target, saved, done)
    values (fam, kid, r.title, r.cost_pts, 0, false) returning * into g;
  return g;
end $$;
