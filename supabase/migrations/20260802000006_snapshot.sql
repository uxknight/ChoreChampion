-- Chore Champions — one-call family snapshot for the client.
-- Everything scoped to the caller's family, with authoritative PT time and the
-- current-period completions attached to each chore. SELECT-only / stable.

create or replace function family_snapshot()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare fam uuid; parent boolean; kid uuid; d date; wk text;
begin
  fam := current_family_id();
  if fam is null then
    return jsonb_build_object('viewer', jsonb_build_object('kind','none'));
  end if;
  parent := is_parent();
  kid := current_kid_id();
  d  := app_today();
  wk := app_week_key();

  return jsonb_build_object(
    'family_id', fam,
    'today', d,
    'week_key', wk,
    'iso_week', to_char(d,'IW')::int,
    'biweekly_on', is_biweekly_on(),
    'viewer', jsonb_build_object(
      'kind', case when parent then 'parent' else 'kid' end,
      'profile_id', coalesce(
        (select p.id from profiles p where p.user_id = auth.uid() and p.family_id = fam limit 1), kid),
      'approved', true),
    'settings', (select to_jsonb(s) from settings s where s.family_id = fam),
    'kids', coalesce((select jsonb_agg(to_jsonb(p) order by p.sort)
                      from profiles p where p.family_id = fam and p.role='kid'), '[]'),
    'chores', coalesce((
      select jsonb_agg(
        to_jsonb(c) || jsonb_build_object(
          'period_entries', coalesce((
            select jsonb_agg(to_jsonb(e) order by e.created_at)
            from completions e
            where e.chore_id = c.id and (
              case
                when c.freq in ('twice_daily','daily','ondemand') then e.occurred_on = d
                when c.freq = 'weekly'   then e.week_key = wk
                when c.freq = 'biweekly' then e.week_key in (wk, prev_week_key())
              end)
          ), '[]')
        ) order by c.base_pts desc, c.sort)
      from chores c where c.family_id = fam and c.deleted_at is null), '[]'),
    'rewards', coalesce((select jsonb_agg(to_jsonb(r) order by r.sort)
                         from rewards r where r.family_id = fam and r.deleted_at is null), '[]'),
    'ellie_rewards', coalesce((select jsonb_agg(to_jsonb(r) order by r.sort)
                               from ellie_rewards r where r.family_id = fam and r.deleted_at is null), '[]'),
    'deductions', coalesce((select jsonb_agg(to_jsonb(x) order by x.pts desc)
                            from deduction_rules x where x.family_id = fam and x.deleted_at is null), '[]'),
    'goals', coalesce((select jsonb_agg(to_jsonb(g)) from goals g where g.family_id = fam), '[]'),
    'redemptions', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc)
                             from redemptions x where x.family_id = fam), '[]'),
    'completions', coalesce((select jsonb_agg(to_jsonb(e))
                             from completions e
                             where e.family_id = fam
                               and (e.occurred_on = d or e.week_key in (wk, prev_week_key()))), '[]'),
    'checkins', coalesce((select jsonb_agg(jsonb_build_object('kid_id',k.kid_id,'occurred_on',k.occurred_on))
                          from checkins k where k.family_id = fam and k.occurred_on = d), '[]'),
    'room_check_today', exists(select 1 from room_checks where family_id = fam and occurred_on = d),
    'tally_ran', exists(select 1 from tally_runs where family_id = fam and week_key = wk),
    'pending_devices', case when parent then coalesce((
        select jsonb_agg(jsonb_build_object('id',dr.id,'kid_id',dr.kid_id,'device_label',dr.device_label))
        from device_registrations dr where dr.family_id = fam and not dr.approved), '[]') else '[]' end
  );
end $$;
