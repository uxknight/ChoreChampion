-- Chore Champions — a third reward type: 'flexible'.
-- Like an instant redeem, but the kid chooses how many banked points to put
-- toward it (e.g. a Temu order — pick something, allocate the points for it).

alter table rewards drop constraint rewards_type_check;
alter table rewards add constraint rewards_type_check check (type in ('spend','goal','flexible'));

create or replace function redeem_flexible(p_reward_id uuid, p_amount numeric, p_kid_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fam uuid; kid uuid; r rewards; bal numeric;
begin
  fam := current_family_id();
  kid := _actor_kid(p_kid_id);
  select * into r from rewards where id = p_reward_id and family_id = fam and deleted_at is null;
  if r.id is null then raise exception 'no_reward'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
  select bank into bal from profiles where id = kid;
  if bal < p_amount then raise exception 'insufficient_bank'; end if;
  update profiles set bank = round_half(bank - p_amount) where id = kid;
  insert into redemptions(family_id, kid_id, title, cost, occurred_on)
    values (fam, kid, r.title, p_amount::text, app_today());
  return jsonb_build_object('title', r.title, 'cost', p_amount);
end $$;
