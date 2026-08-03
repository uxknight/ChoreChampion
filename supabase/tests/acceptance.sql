-- Chore Champions — B9 acceptance tests.
-- Run against a freshly reset DB (seed = Knight family). Each test raises on
-- failure; the final SELECT prints the pass banner. Runs as postgres, switching
-- to the `authenticated` role (via SET ROLE) for RLS-denial checks.

\set ON_ERROR_STOP on
\set VERBOSITY terse

-- fixed seed IDs as constant functions (psql :vars are not interpolated inside DO blocks)
create or replace function _fam()   returns uuid language sql immutable as $c$ select 'f1000000-0000-0000-0000-000000000001'::uuid $c$;
create or replace function _upar()  returns uuid language sql immutable as $c$ select 'a0000000-0000-0000-0000-00000000d001'::uuid $c$;
create or replace function _uvera() returns uuid language sql immutable as $c$ select 'a0000000-0000-0000-0000-00000000d002'::uuid $c$;
create or replace function _uslav() returns uuid language sql immutable as $c$ select 'a0000000-0000-0000-0000-00000000d003'::uuid $c$;
create or replace function _uell()  returns uuid language sql immutable as $c$ select 'a0000000-0000-0000-0000-00000000d004'::uuid $c$;
create or replace function _pvera() returns uuid language sql immutable as $c$ select 'c0000000-0000-0000-0000-000000000001'::uuid $c$;
create or replace function _pslav() returns uuid language sql immutable as $c$ select 'c0000000-0000-0000-0000-000000000002'::uuid $c$;
create or replace function _pell()  returns uuid language sql immutable as $c$ select 'c0000000-0000-0000-0000-000000000003'::uuid $c$;

-- impersonation helpers (session GUC; SECURITY DEFINER RPCs read auth.uid() from it)
create or replace function _login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;
create or replace function _logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', false);
$$;

-- generic assert
create or replace function _ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

-- =====================================================================
-- Test 1: weekly chore cannot be double-claimed; twice-daily capped at 2/day
-- =====================================================================
do $$
declare wk uuid; td uuid; c1 uuid; ok boolean;
begin
  perform _login(_uvera());
  select id into wk from chores where family_id = _fam() and freq='weekly' limit 1;
  perform claim_chore(wk);                 -- 1st ok
  begin perform _login(_uslav()); perform claim_chore(wk); ok:=false;   -- 2nd (other kid) must fail
  exception when others then ok:=true; end;
  perform _ok(ok, 'weekly chore cannot be double-claimed (household-wide)');

  perform _login(_uvera());
  select id into td from chores where family_id = _fam() and freq='twice_daily' limit 1;
  perform claim_chore(td);
  perform _login(_uslav()); perform claim_chore(td);   -- 2nd allowed (limit 2)
  begin perform _login(_uvera()); perform claim_chore(td); ok:=false;   -- 3rd must fail
  exception when others then ok:=true; end;
  perform _ok(ok, 'twice-daily capped at 2 per day');
end $$;

-- =====================================================================
-- Test 2: 3★ on a 3-pt chore yields 4.5; 5 consecutive 3★ pays +3 and resets
-- =====================================================================
do $$
declare ch uuid; comp uuid; res jsonb; wbefore numeric; wafter numeric; i int; qs int;
begin
  -- reset Vera's week/streak to a clean slate for deterministic math
  update profiles set week=0, quality_streak=0 where id = _pvera();
  perform _login(_uvera());
  select id into ch from chores where family_id=_fam() and base_pts=3 and freq='weekly' limit 1;
  -- one 3-pt claim, rate 3★
  insert into completions(family_id,chore_id,kid_id,title_snapshot,pts_snapshot,occurred_on,week_key,status)
    values(_fam(),ch,_pvera(),'t',3,app_today(),app_week_key(),'pending') returning id into comp;
  perform _login(_upar());
  res := rate_completion(comp, 3);
  perform _ok((res->>'earned')::numeric = 4.5, '3★ on 3-pt chore yields 4.5 pts');

  -- streak: need 5 consecutive 3★ to fire +3. We already did 1 above (qs=1).
  for i in 1..4 loop
    insert into completions(family_id,chore_id,kid_id,title_snapshot,pts_snapshot,occurred_on,week_key,status)
      values(_fam(),ch,_pvera(),'t',1,app_today(),app_week_key(),'pending') returning id into comp;
    res := rate_completion(comp, 3);
  end loop;
  select quality_streak into qs from profiles where id=_pvera();
  perform _ok((res->>'streak_bonus')::numeric = 3, '5th consecutive 3★ pays +3 bonus');
  perform _ok(qs = 0, 'quality streak resets to 0 after bonus');
end $$;

-- =====================================================================
-- Test 3: deduction floors at 0, respects 6-pt cap, never touches bank, resets clean streak
-- =====================================================================
do $$
declare rule2 uuid; rule3 uuid; amt jsonb;
begin
  update profiles set week=5, week_deducted=0, bank=100, clean_days=4 where id=_pvera();
  update profiles set week=1, week_deducted=0, bank=50,  clean_days=4 where id=_pslav();
  select id into rule3 from deduction_rules where family_id=_fam() and pts=3 limit 1;
  perform _login(_upar());
  amt := apply_deduction(rule3);   -- -3 each
  perform _ok((select week from profiles where id=_pvera()) = 2, 'deduction subtracts from week (5-3=2)');
  perform _ok((select week from profiles where id=_pslav()) = 0, 'deduction floors week at 0 (1-3 -> 0)');
  perform _ok((select bank from profiles where id=_pvera()) = 100
          and (select bank from profiles where id=_pslav()) = 50, 'deduction never touches bank');
  perform _ok((select clean_days from profiles where id=_pvera()) = 0
          and (select clean_days from profiles where id=_pslav()) = 0, 'deduction resets clean streaks');

  -- cap: give Vera plenty of week so the 6-pt cap is the binding constraint.
  update profiles set week=100, week_deducted=0 where id=_pvera();
  amt := apply_deduction(rule3);   -- -3  -> deducted 3, week 97
  amt := apply_deduction(rule3);   -- -3  -> deducted 6, week 94
  amt := apply_deduction(rule3);   -- room=0 -> hit 0 (capped)
  perform _ok((select week_deducted from profiles where id=_pvera()) = 6, 'weekly deduction cap holds at exactly 6');
  perform _ok((select week from profiles where id=_pvera()) = 94, 'deductions past the cap take nothing more');
end $$;

-- =====================================================================
-- Test 4: 7th clean room-check pays +5 each and resets; refuses 2nd run same day
-- =====================================================================
do $$
declare r jsonb; ok boolean;
begin
  delete from room_checks where family_id=_fam();
  update profiles set week=0, clean_days=6 where id in (_pvera(),_pslav());  -- next check = 7th
  perform _login(_upar());
  r := room_check();
  perform _ok((r->>'bonus')::boolean = true, '7th clean check awards the streak bonus');
  perform _ok((select week from profiles where id=_pvera())=5
          and (select week from profiles where id=_pslav())=5, 'clean-streak bonus is +5 each');
  perform _ok((select clean_days from profiles where id=_pvera())=0, 'clean streak resets after bonus');
  begin r := room_check(); ok:=false; exception when others then ok:=true; end;
  perform _ok(ok, 'room check refuses a second run the same day');
end $$;

-- =====================================================================
-- Test 5: hotspot invisible until armed, disappears after claim, enters pending
-- =====================================================================
do $$
declare hs uuid; ok boolean; comp completions;
begin
  select id into hs from chores where family_id=_fam() and freq='ondemand' limit 1;
  update chores set active=false where id=hs;
  perform _login(_uvera());
  begin comp := claim_chore(hs); ok:=false; exception when others then ok:=true; end;
  perform _ok(ok, 'hotspot cannot be claimed while unarmed');
  perform _login(_upar()); perform toggle_hotspot(hs);            -- arm it
  perform _ok((select active from chores where id=hs)=true, 'parent can arm a hotspot');
  perform _login(_uvera()); comp := claim_chore(hs);
  perform _ok(comp.status='claimed', 'hotspot On-it creates a claim');
  perform _ok((select active from chores where id=hs)=false, 'hotspot disarms after being claimed');
end $$;

-- =====================================================================
-- Test 6: tally moves week->bank exactly once per week (idempotent); manual + cron
-- =====================================================================
do $$
declare r jsonb;
begin
  delete from tally_runs where family_id=_fam();
  update profiles set week=10, bank=20, week_deducted=4 where id=_pvera();
  perform _login(_upar());
  r := run_tally();
  perform _ok((r->>'ran')::boolean = true, 'first tally runs');
  perform _ok((select bank from profiles where id=_pvera())=30
          and (select week from profiles where id=_pvera())=0
          and (select week_deducted from profiles where id=_pvera())=0, 'tally moves week->bank and zeroes counters');
  r := run_tally();
  perform _ok((r->>'ran')::boolean = false, 'second manual tally same week is a no-op (idempotent)');
  perform _ok((select bank from profiles where id=_pvera())=30, 'idempotent tally did not double-bank');
  -- cron path uses _tally() directly (service role)
  update profiles set week=7 where id=_pvera();
  r := _tally(_fam(), app_week_key());
  perform _ok((r->>'ran')::boolean = false
          and (select bank from profiles where id=_pvera())=30, 'cron path also idempotent for the week');
end $$;

-- =====================================================================
-- Test 7: cartoon states none/pending/earned/missed
-- =====================================================================
do $$
declare d date := app_today(); r record; i int; first_id uuid;
begin
  perform _login(_upar());
  delete from completions where family_id=_fam() and occurred_on=d;
  perform _ok(cartoon_status()='none', 'cartoon: none when no daily chores done');

  -- one daily slot at 3★ is not enough — the whole daily board must be cleared
  select id into first_id from chores
    where family_id=_fam() and freq in ('daily','twice_daily') and deleted_at is null limit 1;
  insert into completions(family_id,chore_id,kid_id,title_snapshot,pts_snapshot,occurred_on,week_key,status,stars,earned)
    values(_fam(),first_id,_pvera(),'t',1,d,app_week_key(),'rated',3,1.5);
  perform _ok(cartoon_status()='pending', 'cartoon: pending until ALL daily chores are done at 3★');

  -- fill every daily slot (daily=1, twice_daily=2) at 3★ -> earned
  delete from completions where family_id=_fam() and occurred_on=d;
  for r in select id, (case when freq='twice_daily' then 2 else 1 end) as slots
             from chores where family_id=_fam() and freq in ('daily','twice_daily') and deleted_at is null loop
    for i in 1..r.slots loop
      insert into completions(family_id,chore_id,kid_id,title_snapshot,pts_snapshot,occurred_on,week_key,status,stars,earned)
        values(_fam(),r.id,_pvera(),'t',1,d,app_week_key(),'rated',3,1.5);
    end loop;
  end loop;
  perform _ok(cartoon_status()='earned', 'cartoon: earned when every daily chore is done at 3★');

  -- knock one down to 2★ -> a perfect day is no longer possible
  update completions set stars=2
    where id = (select id from completions where family_id=_fam() and occurred_on=d limit 1);
  perform _ok(cartoon_status()='missed', 'cartoon: missed when any daily chore is under 3★');
end $$;

-- =====================================================================
-- Test 8: goal allocation clamps to min(amount, bank, remaining)
-- =====================================================================
do $$
declare g uuid; rw uuid; r jsonb;
begin
  update profiles set bank=30 where id=_pvera();
  perform _login(_uvera());
  select id into rw from rewards where family_id=_fam() and type='goal' order by cost_pts limit 1; -- Sky Zone 110
  g := (start_goal(rw)).id;
  r := allocate_to_goal(g, 1000);   -- amount huge -> clamps to bank (30)
  perform _ok((r->>'added')::numeric = 30, 'goal allocation clamps to bank');
  perform _ok((select bank from profiles where id=_pvera())=0, 'goal allocation debits bank');
  perform _ok((r->>'saved')::numeric = 30, 'goal saved reflects the allocation');
end $$;

-- =====================================================================
-- Test 9: kid session cannot call parent RPCs; RLS blocks direct settings write
-- =====================================================================
do $$
declare ok boolean; rule uuid; comp uuid;
begin
  select id into rule from deduction_rules where family_id=_fam() limit 1;
  perform _login(_uvera());
  begin perform apply_deduction(rule); ok:=false; exception when others then ok:=true; end;
  perform _ok(ok, 'kid cannot call apply_deduction');
  begin perform room_check(); ok:=false; exception when others then ok:=true; end;
  perform _ok(ok, 'kid cannot call room_check');
  begin perform run_tally(); ok:=false; exception when others then ok:=true; end;
  perform _ok(ok, 'kid cannot call run_tally');
  select id into comp from completions where family_id=_fam() and status='pending' limit 1;
  if comp is not null then
    begin perform rate_completion(comp,3); ok:=false; exception when others then ok:=true; end;
    perform _ok(ok, 'kid cannot rate completions');
  end if;
end $$;

-- RLS: as the `authenticated` role (not superuser), a kid cannot UPDATE settings directly
do $$
declare denied boolean := false;
begin
  perform _login(_uvera());
  set local role authenticated;
  begin
    update settings set point_value = 9.99 where family_id = _fam();
    denied := (not found);  -- 0 rows updated => RLS blocked it
  exception when insufficient_privilege then denied := true;
  end;
  reset role;
  perform _ok(denied, 'RLS blocks a kid from directly updating settings');
end $$;

-- also: kid cannot directly UPDATE their own points
do $$
declare denied boolean := false;
begin
  perform _login(_uvera());
  set local role authenticated;
  begin
    update profiles set bank = bank + 1000 where id = _pvera();
    denied := (not found);
  exception when insufficient_privilege then denied := true;
  end;
  reset role;
  perform _ok(denied, 'RLS blocks a kid from directly editing their point balance');
end $$;

-- =====================================================================
-- Test 10: On it -> Done two-step; first claim locks others; only owner marks done
-- =====================================================================
do $$
declare ch uuid; c1 completions; ok boolean; res jsonb;
begin
  select id into ch from chores where family_id=_fam() and freq='weekly' and base_pts=2 limit 1;
  delete from completions where chore_id=ch;            -- clean slate
  perform _login(_uvera());
  c1 := claim_chore(ch);
  perform _ok(c1.status='claimed', 'On it creates a claimed reservation');

  begin perform _login(_uslav()); perform claim_chore(ch); ok:=false;   -- locked
  exception when others then ok:=true; end;
  perform _ok(ok, 'a second kid cannot claim a chore already on-it');

  begin perform _login(_uslav()); perform mark_done(c1.id); ok:=false;  -- not owner
  exception when others then ok:=true; end;
  perform _ok(ok, 'only the claim owner can mark it done');

  perform _login(_uvera());
  c1 := mark_done(c1.id);
  perform _ok(c1.status='pending', 'Done transitions the claim to pending review');

  perform _login(_upar());
  res := rate_completion(c1.id, 2);
  perform _ok((res->>'earned')::numeric = 2, 'rating the done chore pays out');
end $$;

select '========== ALL ACCEPTANCE TESTS PASSED ==========' as result;
