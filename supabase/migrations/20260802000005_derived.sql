-- Chore Champions — derived read helpers (never stored).

-- Cartoon status for a kid on a given day (prototype cartoonStatus):
--   none    : no completions that day
--   pending : at least one completion still awaiting a quality check
--   earned  : every completion that day is rated 3★
--   missed  : rated, but not all 3★
create or replace function cartoon_status(p_kid_id uuid, p_day date default null)
returns text language sql stable security definer set search_path = public as $$
  select case
    when count(*) = 0 then 'none'
    when count(*) filter (where status = 'pending') > 0 then 'pending'
    when count(*) filter (where stars = 3) = count(*) then 'earned'
    else 'missed'
  end
  from completions
  where kid_id = p_kid_id
    and occurred_on = coalesce(p_day, app_today());
$$;

-- Current-period completion count for a chore (household-wide), for the board UI.
create or replace function chore_period_count(p_chore_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from completions c
   join chores ch on ch.id = c.chore_id
  where c.chore_id = p_chore_id
    and case
          when ch.freq in ('twice_daily','daily','ondemand') then c.occurred_on = app_today()
          when ch.freq = 'weekly'   then c.week_key = app_week_key()
          when ch.freq = 'biweekly' then c.week_key in (app_week_key(), prev_week_key())
        end;
$$;
