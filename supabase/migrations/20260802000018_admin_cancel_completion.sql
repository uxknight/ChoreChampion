-- Chore Champions — let a parent cancel a completion that's awaiting a quality
-- check (or still claimed) — e.g. it wasn't actually done. Frees the chore back
-- up (re-arms hotspots) and awards nothing. Rated completions can't be cancelled.

create or replace function admin_cancel_completion(p_completion_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare fam uuid; e completions;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  select * into e from completions where id = p_completion_id and family_id = fam;
  if e.id is null then raise exception 'no_completion'; end if;
  if e.status = 'rated' then raise exception 'already_rated'; end if;
  update chores set active = true where id = e.chore_id and freq = 'ondemand';
  delete from completions where id = e.id;
end $$;
