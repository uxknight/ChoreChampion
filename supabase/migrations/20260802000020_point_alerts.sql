-- Chore Champions — "point alerts": a per-kid queue of point awards/deductions
-- the kid hasn't seen yet, so the app can play a celebration (or a sad) animation
-- the next time that child opens it. Award/bonus/deduction RPCs enqueue an alert;
-- the client marks it seen once shown.

create table if not exists point_alerts (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  kid_id     uuid not null references profiles(id) on delete cascade,
  kind       text not null check (kind in ('award','deduction')),
  title      text not null,
  delta      numeric not null,
  seen       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists point_alerts_unseen_idx on point_alerts(kid_id) where not seen;

alter table point_alerts enable row level security;
drop policy if exists fam_read on point_alerts;
create policy fam_read on point_alerts for select using (family_id = current_family_id());
grant all on point_alerts to anon, authenticated, service_role;

-- mark one alert seen (the kid it belongs to, or a parent)
create or replace function mark_alert_seen(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare fam uuid;
begin
  fam := current_family_id();
  update point_alerts set seen = true
   where id = p_id and family_id = fam and (is_parent() or kid_id = current_kid_id());
end $$;

-- award_points: also enqueue an award alert
create or replace function award_points(p_kid_id uuid, p_amount numeric, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; k profiles; ttl text;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  select * into k from profiles where id = p_kid_id and family_id = fam and role = 'kid';
  if k.id is null then raise exception 'no_kid'; end if;
  if k.mode <> 'points' then raise exception 'not_points_kid'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
  ttl := coalesce(nullif(btrim(p_reason), ''), 'Bonus points');
  update profiles set week = round_half(week + p_amount) where id = k.id;
  insert into bonus_events(family_id, rule_id, kid_id, title, pts, occurred_on, week_key)
    values (fam, null, k.id, ttl, p_amount, app_today(), app_week_key());
  insert into point_alerts(family_id, kid_id, kind, title, delta) values (fam, k.id, 'award', ttl, p_amount);
  return jsonb_build_object('title', ttl, 'pts', p_amount, 'kid_id', k.id);
end $$;

-- award_bonus: also enqueue an award alert
create or replace function award_bonus(p_rule_id uuid, p_kid_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; b bonus_rules; k profiles;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  select * into b from bonus_rules where id = p_rule_id and family_id = fam and deleted_at is null;
  if b.id is null then raise exception 'no_bonus'; end if;
  select * into k from profiles where id = p_kid_id and family_id = fam and role = 'kid';
  if k.id is null then raise exception 'no_kid'; end if;
  if k.mode <> 'points' then raise exception 'not_points_kid'; end if;
  update profiles set week = round_half(week + b.pts) where id = k.id;
  insert into bonus_events(family_id, rule_id, kid_id, title, pts, occurred_on, week_key)
    values (fam, b.id, k.id, b.title, b.pts, app_today(), app_week_key());
  insert into point_alerts(family_id, kid_id, kind, title, delta) values (fam, k.id, 'award', b.title, b.pts);
  return jsonb_build_object('title', b.title, 'pts', b.pts, 'kid_id', k.id);
end $$;

-- apply_deduction: enqueue a deduction alert for each kid actually docked
create or replace function apply_deduction(p_rule_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; d deduction_rules; cap numeric; k record; hit numeric; room numeric; amounts jsonb := '{}'::jsonb;
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
       set week = round_half(week - hit), week_deducted = round_half(week_deducted + hit), clean_days = 0
     where id = k.id;
    amounts := amounts || jsonb_build_object(k.id::text, hit);
    if hit > 0 then
      insert into point_alerts(family_id, kid_id, kind, title, delta) values (fam, k.id, 'deduction', d.title, -hit);
    end if;
  end loop;

  insert into deduction_events(family_id, rule_id, occurred_on, week_key, amounts)
    values (fam, d.id, app_today(), app_week_key(), amounts);
  return amounts;
end $$;

-- family_snapshot: expose the viewer's unseen point alerts (parent sees all kids')
create or replace function family_snapshot()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare fam uuid; parent boolean; kid uuid; d date; wk text;
begin
  fam := current_family_id();
  if fam is null then return jsonb_build_object('viewer', jsonb_build_object('kind','none')); end if;
  parent := is_parent();
  kid := current_kid_id();
  d  := app_today();
  wk := app_week_key();

  return jsonb_build_object(
    'family_id', fam, 'today', d, 'week_key', wk, 'iso_week', to_char(d,'IW')::int,
    'biweekly_on', is_biweekly_on(),
    'viewer', jsonb_build_object('kind', case when parent then 'parent' else 'kid' end,
      'profile_id', coalesce((select p.id from profiles p where p.user_id = auth.uid() and p.family_id = fam limit 1), kid),
      'approved', true),
    'settings', (select to_jsonb(s) from settings s where s.family_id = fam),
    'kids', coalesce((select jsonb_agg(to_jsonb(p) order by p.sort) from profiles p where p.family_id = fam and p.role='kid'), '[]'),
    'chores', coalesce((
      select jsonb_agg(to_jsonb(c) || jsonb_build_object('period_entries', coalesce((
            select jsonb_agg(to_jsonb(e) order by e.created_at) from completions e
            where e.chore_id = c.id and (case
                when c.freq in ('twice_daily','daily','ondemand') then e.occurred_on = d
                when c.freq = 'weekly' then e.week_key = wk
                when c.freq = 'biweekly' then e.week_key in (wk, prev_week_key()) end)), '[]')) order by c.base_pts desc, c.sort)
      from chores c where c.family_id = fam and c.deleted_at is null), '[]'),
    'rewards', coalesce((select jsonb_agg(to_jsonb(r) order by r.sort) from rewards r where r.family_id = fam and r.deleted_at is null), '[]'),
    'ellie_rewards', coalesce((select jsonb_agg(to_jsonb(r) order by r.sort) from ellie_rewards r where r.family_id = fam and r.deleted_at is null), '[]'),
    'deductions', coalesce((select jsonb_agg(to_jsonb(x) order by x.pts desc) from deduction_rules x where x.family_id = fam and x.deleted_at is null), '[]'),
    'deduction_events', coalesce((select jsonb_agg(jsonb_build_object('id', de.id, 'title', coalesce(dr.title, 'Deduction'),
               'occurred_on', de.occurred_on, 'week_key', de.week_key, 'amounts', de.amounts, 'created_at', de.created_at) order by de.created_at desc)
      from deduction_events de left join deduction_rules dr on dr.id = de.rule_id where de.family_id = fam and de.week_key = wk), '[]'),
    'bonus_rules', coalesce((select jsonb_agg(to_jsonb(x) order by x.pts desc) from bonus_rules x where x.family_id = fam and x.deleted_at is null), '[]'),
    'bonus_events', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from bonus_events x where x.family_id = fam and x.week_key = wk), '[]'),
    'point_alerts', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from point_alerts a
      where a.family_id = fam and not a.seen and (parent or a.kid_id = kid)), '[]'),
    'goals', coalesce((select jsonb_agg(to_jsonb(g)) from goals g where g.family_id = fam), '[]'),
    'redemptions', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from redemptions x where x.family_id = fam), '[]'),
    'completions', coalesce((select jsonb_agg(to_jsonb(e)) from completions e where e.family_id = fam and (e.occurred_on = d or e.week_key in (wk, prev_week_key()))), '[]'),
    'checkins', coalesce((select jsonb_agg(jsonb_build_object('kid_id',k2.kid_id,'occurred_on',k2.occurred_on)) from checkins k2 where k2.family_id = fam and k2.occurred_on = d), '[]'),
    'room_check_today', exists(select 1 from room_checks where family_id = fam and occurred_on = d),
    'tally_ran', exists(select 1 from tally_runs where family_id = fam and week_key = wk),
    'pending_devices', case when parent then coalesce((select jsonb_agg(jsonb_build_object('id',dr2.id,'kid_id',dr2.kid_id,'device_label',dr2.device_label))
        from device_registrations dr2 where dr2.family_id = fam and not dr2.approved), '[]') else '[]' end
  );
end $$;
