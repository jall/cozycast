-- ============================================================
-- CozyCase: Private Podcast Sharing App
-- Full Supabase Postgres Schema
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles: extends Supabase auth.users
create table profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  name       text        not null,
  email      text        not null,
  created_at timestamptz default now()
);

-- Friendships: bidirectional pairs
create table friendships (
  user_id    uuid        not null references profiles(id),
  friend_id  uuid        not null references profiles(id),
  created_at timestamptz default now(),
  primary key (user_id, friend_id)
);

-- Invites: short codes for friend invitations
create table invites (
  code       text        primary key,
  creator_id uuid        not null references profiles(id),
  used_by    uuid        references profiles(id),
  created_at timestamptz default now(),
  used_at    timestamptz
);

-- Casts: audio episodes shared with friends
create table casts (
  id          uuid        primary key default gen_random_uuid(),
  creator_id  uuid        not null references profiles(id),
  title       text        not null,
  description text,
  participants text,
  audio_path  text        not null,
  duration    integer,
  created_at  timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles    enable row level security;
alter table friendships enable row level security;
alter table invites     enable row level security;
alter table casts       enable row level security;

-- ---- profiles ----

create policy "profiles_select_authenticated"
  on profiles for select
  to authenticated
  using (true);

-- INSERT is handled by the handle_new_user trigger (service role).
-- No INSERT policy for regular users.

create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---- friendships ----

create policy "friendships_select_own"
  on friendships for select
  to authenticated
  using (auth.uid() = user_id);

-- INSERT and DELETE are handled via security-definer RPC functions.
-- No direct INSERT/DELETE policies for regular users.

-- ---- invites ----

create policy "invites_select_own"
  on invites for select
  to authenticated
  using (creator_id = auth.uid());

create policy "invites_insert_own"
  on invites for insert
  to authenticated
  with check (creator_id = auth.uid());

-- UPDATE is handled via the redeem_invite RPC function.

-- ---- casts ----

create policy "casts_insert_own"
  on casts for insert
  to authenticated
  with check (creator_id = auth.uid());

create policy "casts_select_own_or_friends"
  on casts for select
  to authenticated
  using (
    creator_id = auth.uid()
    or exists (
      select 1 from friendships
      where friendships.user_id = auth.uid()
        and friendships.friend_id = casts.creator_id
    )
  );

create policy "casts_delete_own"
  on casts for delete
  to authenticated
  using (creator_id = auth.uid());

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create a profile when a new user signs up
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- Redeem an invite code: mark it used and create bidirectional friendship
create or replace function redeem_invite(invite_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
begin
  -- Find and lock the invite row
  select creator_id into v_creator_id
  from public.invites
  where code = invite_code
    and used_by is null
  for update;

  if not found then
    raise exception 'Invalid or already-used invite code';
  end if;

  if v_creator_id = auth.uid() then
    raise exception 'You cannot redeem your own invite';
  end if;

  -- Mark the invite as used
  update public.invites
  set used_by = auth.uid(),
      used_at = now()
  where code = invite_code;

  -- Insert bidirectional friendship rows
  insert into public.friendships (user_id, friend_id)
  values (auth.uid(), v_creator_id),
         (v_creator_id, auth.uid())
  on conflict do nothing;
end;
$$;

-- Generate a random 6-character invite code
create or replace function generate_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  chars  text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i      integer;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  end loop;

  insert into public.invites (code, creator_id)
  values (result, auth.uid());

  return result;
end;
$$;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================
-- The "casts" bucket itself is declared in supabase/config.toml
-- (private, 200 MiB limit, audio/* only). These policies control who
-- can upload, read, and delete objects within it. Audio paths are of
-- the form "<uid>/<timestamp>.m4a", so the first folder segment is the
-- creator's user id.

-- Upload: authenticated users may upload only into their own folder.
create policy "casts_objects_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'casts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Read: the creator, or any friend of the creator, may read an object.
create policy "casts_objects_select_own_or_friends"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'casts'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.friendships
        where friendships.user_id = auth.uid()
          and friendships.friend_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Delete: users may delete objects only in their own folder.
create policy "casts_objects_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'casts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
