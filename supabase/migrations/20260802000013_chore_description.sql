-- Chore Champions — add a description/instructions field to chores.
-- Shown to kids when they tap the "?" on a chore card. Existing chores get NULL
-- (parents fill them in); the seed_family defaults below give new families helpful text.

alter table chores add column if not exists description text;

create or replace function seed_family(fam uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from chores where family_id = fam) then
    return;
  end if;

  insert into settings(family_id) values (fam) on conflict (family_id) do nothing;

  insert into chores(family_id, emoji, title, description, base_pts, freq, active, sort) values
    (fam, '🍽️', 'Put clean dishes away',                     'Empty the clean dishwasher and put every dish, cup, and utensil back where it belongs.', 1, 'twice_daily', true,  1),
    (fam, '🫧', 'Put dirty dishes in the dishwasher',         'Scrape, rinse, and load all the dirty dishes. Start it if it''s full.', 1, 'twice_daily', true,  2),
    (fam, '🧹', 'Sweep the kitchen floor',                    'Sweep up crumbs and dirt from the whole kitchen floor — get under the table too.', 1, 'twice_daily', true,  3),
    (fam, '🧽', 'Clean surfaces, countertops & stove',        'Wipe down all the counters, the table, and the stovetop until they''re spotless.', 2, 'twice_daily', true,  4),
    (fam, '👶', 'Clean Nikolina’s chair',                     'Wipe the tray, seat, and straps of the high chair after meals.', 1, 'twice_daily', true,  5),
    (fam, '🪣', 'Wash the kitchen floors',                    'Mop the kitchen floor with cleaner — reach the corners and under the table.', 3, 'weekly',      true,  6),
    (fam, '✨', 'Wash stainless steel (fridge, stove, dishwasher)', 'Polish the fridge, stove, and dishwasher fronts so there are no smudges.', 2, 'weekly',  true,  7),
    (fam, '🚽', 'Clean bathroom #1 (toilet, sink, mirror, floor, shelf)', 'Scrub the toilet, sink, mirror, floor, and shelf until everything shines.', 3, 'weekly', true, 8),
    (fam, '🛁', 'Clean bathroom #2 (toilet, sink, mirror, floor, shelf)', 'Scrub the toilet, sink, mirror, floor, and shelf until everything shines.', 3, 'weekly', true, 9),
    (fam, '🪜', 'Vacuum the stairs',                          'Vacuum every step and the edges, top to bottom.', 2, 'weekly',      true, 10),
    (fam, '🌀', 'Vacuum second floor (3 rooms + hallway)',    'Vacuum all three rooms and the hallway upstairs.', 3, 'weekly',      true, 11),
    (fam, '🚗', 'Clear out the car',                          'Take out all trash and belongings, then tidy the seats and floor.', 3, 'biweekly',    true, 12),
    (fam, '🧻', 'Fold towels & distribute',                   'Fold the clean towels neatly and put them away in each bathroom.', 2, 'biweekly',    true, 13),
    (fam, '🚪', 'Hotspot: reset the entryway',                'Line up the shoes, hang the coats, and clear the entryway surfaces.', 1, 'ondemand',    false,14),
    (fam, '🧰', 'Hotspot: reset the garage',                  'Put tools and items back on their shelves and sweep the garage floor.', 2, 'ondemand',    false,15);

  insert into deduction_rules(family_id, title, pts) values
    (fam, 'Room / personal stuff not picked up at day-end check', 2),
    (fam, 'Personal laundry not done by Sunday dinner',           3),
    (fam, 'Bed not made / backpack not put away',                 1);

  insert into rewards(family_id, title, cost_pts, type, note, sort) values
    (fam, 'Piggy bank cash',                  20,  'spend', 'Cold hard cash for your piggy bank.', 1),
    (fam, 'Temu order',                       40,  'spend', 'Pick something out — orders ship monthly.', 2),
    (fam, 'Play date + snack stipend',        40,  'spend', 'Invite a friend, $10 for snacks or an activity.', 3),
    (fam, 'Dad outing (25% budget bonus!)',   60,  'spend', 'You pick the place. Budget = points value + 25% extra.', 4),
    (fam, 'Hopscotch Portland trip',          60,  'spend', 'Immersive art adventure. Ellie gets in free!', 5),
    (fam, 'Sky Zone monthly membership',      110, 'goal',  'Big goal! Also needs two straight ★★★-quality weeks.', 6),
    (fam, 'Hawaii travel fund 🌺 (50% parent match)', 400, 'goal', 'Every point you save, parents add half again on top.', 7);

  insert into ellie_rewards(family_id, title, stickers, sort) values
    (fam, 'Dollar-store toy pick',   10, 1),
    (fam, 'Extra bedtime story',     10, 2),
    (fam, 'Choose the family movie', 10, 3);
end;
$$;
