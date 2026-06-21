-- ============================================================
-- CozyCast: Explicit per-cast sharing
-- ============================================================
-- Replaces the old "a cast is visible to all of the creator's friends"
-- model with the product's core philosophy: the interviewee controls who
-- receives each recording. A cast is now visible only to:
--   * its creator,
--   * its designated "sharer" (the one person responsible for distributing it),
--   * the people tagged as participants, and
--   * the specific recipients it has been shared with.
--
-- Friends/invites remain — they're now the "address book" of people you CAN
-- share with, not an automatic distribution list.
-- ============================================================

-- ============================================================
-- SCHEMA CHANGES
-- ============================================================

-- A cast gets a manual summary and a designated sharer. (cover art is derived
-- client-side from the cast id for now; AI summary/cover land later behind an
-- Edge Function.)
alter table casts
  add column if not exists summary   text,
  add column if not exists sharer_id uuid references profiles(id);

-- Every existing cast is shared by whoever created it.
update casts set sharer_id = creator_id where sharer_id is null;

-- Participants tagged on a cast. profile_id is set when the participant is a
-- cozycast user (so it can grant them access); name is always kept for display
-- (and lets you tag someone who isn't on the app yet).
create table if not exists cast_participants (
  id         uuid        primary key default gen_random_uuid(),
  cast_id    uuid        not null references casts(id) on delete cascade,
  profile_id uuid        references profiles(id) on delete cascade,
  name       text        not null,
  created_at timestamptz default now(),
  unique (cast_id, profile_id)
);

create index if not exists cast_participants_cast_id_idx on cast_participants (cast_id);
create index if not exists cast_participants_profile_id_idx on cast_participants (profile_id);

-- The specific people a cast has been shared with.
create table if not exists cast_recipients (
  cast_id      uuid        not null references casts(id) on delete cascade,
  recipient_id uuid        not null references profiles(id) on delete cascade,
  shared_by    uuid        not null default auth.uid() references profiles(id),
  created_at   timestamptz default now(),
  primary key (cast_id, recipient_id)
);

create index if not exists cast_recipients_recipient_id_idx on cast_recipients (recipient_id);

-- ============================================================
-- ACCESS HELPERS (security definer → used inside RLS without recursion)
-- ============================================================

-- Can the current user see this cast at all?
create or replace function can_access_cast(p_cast_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    exists (
      select 1 from public.casts c
      where c.id = p_cast_id
        and (c.creator_id = auth.uid() or c.sharer_id = auth.uid())
    )
    or exists (
      select 1 from public.cast_participants cp
      where cp.cast_id = p_cast_id and cp.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.cast_recipients cr
      where cr.cast_id = p_cast_id and cr.recipient_id = auth.uid()
    );
$$;

-- Can the current user manage this cast (edit it, tag participants, choose
-- recipients)? That's the creator or the designated sharer.
create or replace function can_manage_cast(p_cast_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.casts c
    where c.id = p_cast_id
      and (c.creator_id = auth.uid() or c.sharer_id = auth.uid())
  );
$$;

-- Can the current user read this storage object? Maps an audio path back to its
-- cast and reuses can_access_cast.
create or replace function can_access_audio(p_path text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.casts c
    where c.audio_path = p_path
      and public.can_access_cast(c.id)
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- ---- casts: swap the friend-broadcast SELECT for explicit access ----

drop policy if exists "casts_select_own_or_friends" on casts;

create policy "casts_select_accessible"
  on casts for select
  to authenticated
  using (public.can_access_cast(id));

-- The sharer (or creator) may edit the cast — e.g. write the summary.
drop policy if exists "casts_update_manage" on casts;
create policy "casts_update_manage"
  on casts for update
  to authenticated
  using (creator_id = auth.uid() or sharer_id = auth.uid())
  with check (creator_id = auth.uid() or sharer_id = auth.uid());

-- (casts_insert_own and casts_delete_own are unchanged from initial schema.)

-- ---- cast_participants ----

alter table cast_participants enable row level security;

drop policy if exists "cast_participants_select_accessible" on cast_participants;
create policy "cast_participants_select_accessible"
  on cast_participants for select
  to authenticated
  using (public.can_access_cast(cast_id));

drop policy if exists "cast_participants_insert_manage" on cast_participants;
create policy "cast_participants_insert_manage"
  on cast_participants for insert
  to authenticated
  with check (public.can_manage_cast(cast_id));

drop policy if exists "cast_participants_delete_manage" on cast_participants;
create policy "cast_participants_delete_manage"
  on cast_participants for delete
  to authenticated
  using (public.can_manage_cast(cast_id));

-- ---- cast_recipients ----

alter table cast_recipients enable row level security;

drop policy if exists "cast_recipients_select_accessible" on cast_recipients;
create policy "cast_recipients_select_accessible"
  on cast_recipients for select
  to authenticated
  using (public.can_access_cast(cast_id));

drop policy if exists "cast_recipients_insert_manage" on cast_recipients;
create policy "cast_recipients_insert_manage"
  on cast_recipients for insert
  to authenticated
  with check (public.can_manage_cast(cast_id) and shared_by = auth.uid());

drop policy if exists "cast_recipients_delete_manage" on cast_recipients;
create policy "cast_recipients_delete_manage"
  on cast_recipients for delete
  to authenticated
  using (public.can_manage_cast(cast_id));

-- ============================================================
-- STORAGE POLICIES
-- ============================================================
-- Reading an audio object now follows cast access, not friendship.

drop policy if exists "casts_objects_select_own_or_friends" on storage.objects;

create policy "casts_objects_select_accessible"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'casts'
    and public.can_access_audio(name)
  );

-- (Upload/delete-own-folder policies are unchanged from initial schema.)

-- ============================================================
-- GRANTS
-- ============================================================
-- RLS is checked after table privileges, so the new tables (and the new UPDATE
-- on casts) need explicit grants for the authenticated role.

grant update on casts to authenticated;
grant select, insert, delete on cast_participants to authenticated;
grant select, insert, delete on cast_recipients to authenticated;
