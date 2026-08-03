-- Chore Champions — let a kid cancel a chore they're "on it" for (a claimed
-- reservation that hasn't been marked Done yet). Frees it back up for grabs.

create or replace function cancel_claim(p_completion_id uuid, p_kid_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare fam uuid; kid uuid; e completions;
begin
  fam := current_family_id();
  kid := _actor_kid(p_kid_id);
  select * into e from completions where id = p_completion_id and family_id = fam;
  if e.id is null then raise exception 'no_completion'; end if;
  if e.kid_id <> kid then raise exception 'not_your_claim'; end if;
  if e.status <> 'claimed' then raise exception 'cannot_cancel'; end if;
  -- a cancelled hotspot becomes available again
  update chores set active = true where id = e.chore_id and freq = 'ondemand';
  delete from completions where id = e.id;
end $$;
