-- ============================================================
-- CozyCast: local / non-prod seed data
-- ============================================================
-- Useful fixtures so the app has people, friendships, and shared casts to look
-- at in development. Applied automatically by `supabase db reset` (which runs
-- migrations first, then this file) against your LOCAL stack.
--
-- DO NOT run this against the production project. Production data comes from
-- real signups; migrations (not this seed) are what deploy via the Supabase
-- GitHub integration. Everything here uses obviously-fake @cozycast.test emails.
--
-- All seeded users share the password: cozytest1234
-- ============================================================

-- Three cozy characters. Inserting into auth.users fires the handle_new_user
-- trigger, which creates the matching public.profiles row (name from metadata).
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@cozycast.test',
   crypt('cozytest1234', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Alice"}', '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ben@cozycast.test',
   crypt('cozytest1234', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Ben"}', '', '', '', ''),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cleo@cozycast.test',
   crypt('cozytest1234', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Cleo"}', '', '', '', '');

-- Email identities so password login works locally.
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@cozycast.test"}',
   'email', '11111111-1111-1111-1111-111111111111', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"ben@cozycast.test"}',
   'email', '22222222-2222-2222-2222-222222222222', now(), now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"cleo@cozycast.test"}',
   'email', '33333333-3333-3333-3333-333333333333', now(), now(), now());

-- Everyone is in each other's address book (bidirectional friendships).
insert into friendships (user_id, friend_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');

-- Two casts. (audio_path points at objects that don't exist locally — the cards
-- render fine; playback just won't resolve without seeded storage.)
insert into casts (id, creator_id, sharer_id, title, summary, audio_path, duration, created_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Late-night kitchen talk',
   'Alice and Ben ramble about the best comfort foods and a half-formed plan to learn bread.',
   'seed/late-night-kitchen.m4a', 742, now() - interval '2 hours'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
   'The walk we always mean to take',
   'Ben interviews Alice about a trail near her childhood home. Cleo is responsible for sharing it.',
   'seed/the-walk.m4a', 1503, now() - interval '1 day');

-- Who was tagged in each conversation.
insert into cast_participants (cast_id, profile_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Ben'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Alice');

-- Who each cast has been explicitly shared with.
insert into cast_recipients (cast_id, recipient_id, shared_by) values
  -- Alice shared the kitchen talk with Ben and Cleo.
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'),
  -- Cleo (the assigned sharer of Ben's cast) shared it with Alice.
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');
