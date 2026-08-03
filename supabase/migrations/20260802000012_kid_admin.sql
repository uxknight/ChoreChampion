-- Chore Champions — parent kid administration: edit + remove kids.
-- Profile writes go through RPCs (never direct client UPDATE) so the point
-- columns can't be tampered with. These only touch name/emoji/color, and a
-- delete cascades the kid's devices/completions/goals/etc. via existing FKs.

create or replace function update_kid(p_kid_id uuid, p_name text, p_emoji text, p_color text)
returns void language plpgsql security definer set search_path = public as $$
declare fam uuid;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  update profiles set name = p_name, emoji = p_emoji, color = p_color
   where id = p_kid_id and family_id = fam and role = 'kid';
  if not found then raise exception 'no_kid'; end if;
end $$;

create or replace function delete_kid(p_kid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare fam uuid;
begin
  if not is_parent() then raise exception 'parent_only'; end if;
  fam := current_family_id();
  delete from profiles where id = p_kid_id and family_id = fam and role = 'kid';
  if not found then raise exception 'no_kid'; end if;
end $$;
