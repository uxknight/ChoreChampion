-- Local dev + test seed: the Knight family, fully populated.
-- Runs on `supabase db reset`. Uses deterministic UUIDs so tests can target them.
-- NOTE: inserting into auth.users directly is a local-only convenience; production
-- users are created through Supabase Auth.

-- Fixed IDs -----------------------------------------------------------------
--   family        : f1000000-0000-0000-0000-000000000001
--   parent user   : a0000000-0000-0000-0000-0000000000p1 (see below, valid uuids)
-- (uuids must be hex; we use readable-ish hex below)

do $$
declare
  fam       uuid := 'f1000000-0000-0000-0000-000000000001';
  u_parent  uuid := 'a0000000-0000-0000-0000-00000000d001';
  u_vera    uuid := 'a0000000-0000-0000-0000-00000000d002';
  u_slavia  uuid := 'a0000000-0000-0000-0000-00000000d003';
  u_ellie   uuid := 'a0000000-0000-0000-0000-00000000d004';
  p_parent  uuid := 'b0000000-0000-0000-0000-000000000001';
  p_vera    uuid := 'c0000000-0000-0000-0000-000000000001';
  p_slavia  uuid := 'c0000000-0000-0000-0000-000000000002';
  p_ellie   uuid := 'c0000000-0000-0000-0000-000000000003';
begin
  -- auth users (parent has email/password; kids are anonymous devices)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data, is_anonymous)
  values
    ('00000000-0000-0000-0000-000000000000', u_parent, 'authenticated', 'authenticated',
     'parent@knight.test', crypt('password123', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}', false),
    ('00000000-0000-0000-0000-000000000000', u_vera,   'authenticated', 'authenticated',
     null, null, null, now(), now(), '{"provider":"anonymous","providers":["anonymous"]}', '{}', true),
    ('00000000-0000-0000-0000-000000000000', u_slavia, 'authenticated', 'authenticated',
     null, null, null, now(), now(), '{"provider":"anonymous","providers":["anonymous"]}', '{}', true),
    ('00000000-0000-0000-0000-000000000000', u_ellie,  'authenticated', 'authenticated',
     null, null, null, now(), now(), '{"provider":"anonymous","providers":["anonymous"]}', '{}', true)
  on conflict (id) do nothing;

  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (u_parent::text, u_parent,
          jsonb_build_object('sub', u_parent::text, 'email', 'parent@knight.test'),
          'email', now(), now())
  on conflict do nothing;

  -- family + catalog
  insert into families(id, name, invite_code) values (fam, 'Knight Family', 'KNIGHT')
    on conflict (id) do nothing;
  perform seed_family(fam);

  -- profiles
  insert into profiles(id, family_id, user_id, name, emoji, color, role, mode, sort) values
    (p_parent, fam, u_parent, 'Parent', '👑', '#7c5cff', 'parent', 'points', 0),
    (p_vera,   fam, null, 'Vera',   '🦊', '#7c5cff', 'kid', 'points',  1),
    (p_slavia, fam, null, 'Slavia', '🐯', '#ff8a3d', 'kid', 'points',  2),
    (p_ellie,  fam, null, 'Ellie',  '🐣', '#2bb673', 'kid', 'stickers',3)
  on conflict (id) do nothing;

  -- approved kid devices (so `select current_kid_id()` works in tests)
  insert into device_registrations(family_id, kid_id, auth_user_id, approved, device_label) values
    (fam, p_vera,   u_vera,   true, 'Vera iPad'),
    (fam, p_slavia, u_slavia, true, 'Slavia iPad'),
    (fam, p_ellie,  u_ellie,  true, 'Ellie tablet')
  on conflict (auth_user_id) do nothing;
end $$;
