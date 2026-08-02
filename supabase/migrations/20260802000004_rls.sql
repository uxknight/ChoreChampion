-- Chore Champions — Phase 3: Row Level Security.
-- Model: clients may only SELECT rows in their own family. All point-bearing
-- mutations go exclusively through the SECURITY DEFINER RPCs (which enforce the
-- parent/kid role). Parents may additionally write the catalog tables directly.

alter table families            enable row level security;
alter table profiles            enable row level security;
alter table device_registrations enable row level security;
alter table chores              enable row level security;
alter table completions         enable row level security;
alter table deduction_rules     enable row level security;
alter table deduction_events    enable row level security;
alter table room_checks         enable row level security;
alter table rewards             enable row level security;
alter table ellie_rewards       enable row level security;
alter table redemptions         enable row level security;
alter table goals               enable row level security;
alter table sticker_events      enable row level security;
alter table checkins            enable row level security;
alter table settings            enable row level security;
alter table tally_runs          enable row level security;

-- ---- read access: everything scoped to the caller's family --------------
create policy fam_read on families           for select using (id = current_family_id());
create policy fam_read on profiles           for select using (family_id = current_family_id());
create policy fam_read on completions        for select using (family_id = current_family_id());
create policy fam_read on deduction_events   for select using (family_id = current_family_id());
create policy fam_read on room_checks        for select using (family_id = current_family_id());
create policy fam_read on redemptions        for select using (family_id = current_family_id());
create policy fam_read on goals              for select using (family_id = current_family_id());
create policy fam_read on sticker_events     for select using (family_id = current_family_id());
create policy fam_read on checkins           for select using (family_id = current_family_id());
create policy fam_read on tally_runs         for select using (family_id = current_family_id());

-- a kid can also see their own (possibly unapproved) device row
create policy dev_read on device_registrations for select
  using (family_id = current_family_id() or auth_user_id = auth.uid());

-- ---- catalog tables: family read + parent-only write --------------------
create policy fam_read on chores          for select using (family_id = current_family_id());
create policy parent_ins on chores        for insert with check (is_parent() and family_id = current_family_id());
create policy parent_upd on chores        for update using (is_parent() and family_id = current_family_id())
                                                     with check (family_id = current_family_id());

create policy fam_read on deduction_rules for select using (family_id = current_family_id());
create policy parent_ins on deduction_rules for insert with check (is_parent() and family_id = current_family_id());
create policy parent_upd on deduction_rules for update using (is_parent() and family_id = current_family_id())
                                                         with check (family_id = current_family_id());

create policy fam_read on rewards         for select using (family_id = current_family_id());
create policy parent_ins on rewards       for insert with check (is_parent() and family_id = current_family_id());
create policy parent_upd on rewards       for update using (is_parent() and family_id = current_family_id())
                                                     with check (family_id = current_family_id());

create policy fam_read on ellie_rewards   for select using (family_id = current_family_id());
create policy parent_ins on ellie_rewards for insert with check (is_parent() and family_id = current_family_id());
create policy parent_upd on ellie_rewards for update using (is_parent() and family_id = current_family_id())
                                                         with check (family_id = current_family_id());

create policy fam_read on settings        for select using (family_id = current_family_id());
create policy parent_upd on settings      for update using (is_parent() and family_id = current_family_id())
                                                     with check (family_id = current_family_id());

-- NOTE: no INSERT/UPDATE/DELETE policies exist for profiles, completions,
-- goals, redemptions, deduction_events, room_checks, checkins, sticker_events,
-- tally_runs or device_registrations. With RLS enabled and no permissive write
-- policy, direct client writes are denied — they must use the RPCs. This is the
-- server-side enforcement required by B2/B5 (the prototype PIN is gone).
