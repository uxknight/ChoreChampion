-- Chore Champions — shared / "team" chores: multiple kids can join the same
-- chore in a period, and when rated the base points are split evenly among the
-- kids who did it (each still gets their own star multiplier).

alter table chores add column if not exists shared boolean not null default false;

-- claim_chore: a shared chore ignores the household slot limit (any kid may join
-- once); a normal chore keeps first-come-first-served.
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

  if ch.shared then
    if exists (select 1 from completions c where c.chore_id = ch.id and c.kid_id = kid and (
        case when ch.freq in ('twice_daily','daily','ondemand') then c.occurred_on = app_today()
             else c.week_key in (app_week_key(), prev_week_key()) end)) then
      raise exception 'already_joined';
    end if;
  else
    select count(*) into used from completions c
     where c.chore_id = ch.id
       and case
             when ch.freq in ('twice_daily','daily','ondemand') then c.occurred_on = app_today()
             when ch.freq = 'weekly'   then c.week_key = app_week_key()
             when ch.freq = 'biweekly' then c.week_key in (app_week_key(), prev_week_key())
           end;
    lim := case when ch.freq = 'twice_daily' then 2 else 1 end;
    if used >= lim then raise exception 'chore_period_full'; end if;
  end if;

  insert into completions(family_id, chore_id, kid_id, title_snapshot, pts_snapshot,
                          occurred_on, week_key, status, stars, earned)
    values (fam, ch.id, kid,
            case when ch.emoji is not null then ch.emoji || ' ' else '' end || ch.title,
            ch.base_pts, app_today(), app_week_key(), 'claimed', 0, 0)
    returning * into r;

  -- non-shared hotspots disarm once claimed; shared ones stay live for others
  if ch.freq = 'ondemand' and not ch.shared then update chores set active = false where id = ch.id; end if;
  return r;
end $$;

-- rate_completion: for a shared chore, rate ALL of its pending completions in the
-- period together, splitting the base points by how many kids did it.
create or replace function rate_completion(p_completion_id uuid, p_stars int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; e completions; ch chores; s settings; kid profiles;
        v_earned numeric; v_bonus numeric := 0; rater uuid; n int; per numeric; qs int; rec record;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  if p_stars not between 1 and 3 then raise exception 'bad_stars'; end if;
  fam := current_family_id();

  select * into e from completions where id = p_completion_id and family_id = fam;
  if e.id is null then raise exception 'no_completion'; end if;
  if e.status = 'rated' then raise exception 'already_rated'; end if;

  select * into s from settings where family_id = fam;
  select * into ch from chores where id = e.chore_id;
  rater := (select id from profiles where user_id = auth.uid() and family_id = fam limit 1);

  if ch.shared then
    select count(*) into n from completions c
     where c.chore_id = e.chore_id and c.status = 'pending'
       and case when ch.freq in ('twice_daily','daily','ondemand') then c.occurred_on = e.occurred_on
                else c.week_key = e.week_key end;
    if n < 1 then n := 1; end if;
    per := round_half((ch.base_pts / n) * s.mult[p_stars]);

    for rec in select * from completions c
      where c.chore_id = e.chore_id and c.status = 'pending'
        and case when ch.freq in ('twice_daily','daily','ondemand') then c.occurred_on = e.occurred_on
                 else c.week_key = e.week_key end loop
      update completions set status = 'rated', stars = p_stars, earned = per, rated_by = rater where id = rec.id;
      update profiles set week = round_half(week + per) where id = rec.kid_id;
      if p_stars = 3 then
        update profiles set quality_streak = quality_streak + 1 where id = rec.kid_id returning quality_streak into qs;
        if qs >= s.quality_streak_len then
          update profiles set week = round_half(week + s.quality_streak_bonus), quality_streak = 0 where id = rec.kid_id;
        end if;
      else
        update profiles set quality_streak = 0 where id = rec.kid_id;
      end if;
    end loop;
    return jsonb_build_object('earned', per, 'stars', p_stars, 'shared', true, 'split', n);
  end if;

  -- ---- normal (single-kid) chore ----
  v_earned := round_half(e.pts_snapshot * s.mult[p_stars]);
  update completions set status = 'rated', stars = p_stars, earned = v_earned, rated_by = rater where id = e.id;
  select * into kid from profiles where id = e.kid_id;
  update profiles set week = round_half(week + v_earned) where id = kid.id;
  if p_stars = 3 then
    update profiles set quality_streak = quality_streak + 1 where id = kid.id returning quality_streak into kid.quality_streak;
    if kid.quality_streak >= s.quality_streak_len then
      v_bonus := s.quality_streak_bonus;
      update profiles set week = round_half(week + v_bonus), quality_streak = 0 where id = kid.id;
    end if;
  else
    update profiles set quality_streak = 0 where id = kid.id;
  end if;
  return jsonb_build_object('earned', v_earned, 'stars', p_stars, 'streak_bonus', v_bonus, 'kid_id', kid.id);
end $$;
