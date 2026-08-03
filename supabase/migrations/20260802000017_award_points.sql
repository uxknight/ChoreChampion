-- Chore Champions — parent gives an ad-hoc amount of points to one kid, with an
-- optional reason. Logged into bonus_events so it appears on the kid's dashboard.

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
  return jsonb_build_object('title', ttl, 'pts', p_amount, 'kid_id', k.id);
end $$;
