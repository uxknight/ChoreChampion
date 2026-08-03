-- Chore Champions — two-step claim flow.
-- "On it" reserves a chore (status 'claimed'); "Done" transitions it to 'pending'
-- for the parent quality check. The existing household-wide period limit already
-- enforces first-come-first-served: a 'claimed' row counts toward the limit, so
-- once a kid is on it, no one else can claim that slot.

-- 1) widen the status domain
alter table completions drop constraint completions_status_check;
alter table completions add constraint completions_status_check
  check (status in ('claimed','pending','rated'));

-- 2) claim_chore now creates a reservation ('claimed') instead of a done ('pending')
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
            ch.base_pts, app_today(), app_week_key(), 'claimed', 0, 0)
    returning * into r;

  if ch.freq = 'ondemand' then update chores set active = false where id = ch.id; end if;
  return r;
end $$;

-- 3) mark_done: the claim owner marks their reservation complete ('claimed' -> 'pending')
create or replace function mark_done(p_completion_id uuid, p_kid_id uuid default null)
returns completions language plpgsql security definer set search_path = public as $$
declare fam uuid; kid uuid; e completions;
begin
  fam := current_family_id();
  kid := _actor_kid(p_kid_id);
  select * into e from completions where id = p_completion_id and family_id = fam;
  if e.id is null then raise exception 'no_completion'; end if;
  if e.kid_id <> kid then raise exception 'not_your_claim'; end if;
  if e.status <> 'claimed' then raise exception 'not_claimed'; end if;
  update completions set status = 'pending' where id = e.id returning * into e;
  return e;
end $$;

-- 4) cartoon rule (household-wide, per day): cartoons unlock only when EVERY daily
--    chore slot for the family is done and rated ★★★. Because chores are shared
--    first-come, this is a whole-family achievement, not a per-kid one.
--      none    : no daily-chore completions yet today
--      pending : some done at ★★★, but not all daily slots are done+rated yet
--      earned  : every daily slot (daily=1, twice_daily=2) is a rated ★★★ completion
--      missed  : at least one daily chore was rated under ★★★ (perfect day impossible)
drop function if exists cartoon_status(uuid, date);
create or replace function cartoon_status(p_day date default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare fam uuid; d date; total int; entries int; rated3 int; bad int;
begin
  fam := current_family_id();
  d := coalesce(p_day, app_today());
  select coalesce(sum(case when freq = 'twice_daily' then 2 else 1 end), 0) into total
    from chores
    where family_id = fam and deleted_at is null and freq in ('daily','twice_daily');
  select count(*),
         count(*) filter (where status = 'rated' and stars = 3),
         count(*) filter (where status = 'rated' and stars < 3)
    into entries, rated3, bad
    from completions c
    where c.family_id = fam and c.occurred_on = d
      and exists (select 1 from chores ch
                   where ch.id = c.chore_id and ch.freq in ('daily','twice_daily'));
  if total = 0 or entries = 0 then return 'none'; end if;
  if bad > 0 then return 'missed'; end if;
  if rated3 >= total then return 'earned'; end if;
  return 'pending';
end $$;
