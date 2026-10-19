-- Voice notes: little recordings between two people, never more. They live
-- in threads — "just chat", or about a cast you can both hear (optionally
-- pinned to a moment in it) — and the person they're for marks them heard.
-- A voice note is visible to its sender and its recipient only.

create table if not exists voice_notes (
  id          uuid        primary key default gen_random_uuid(),
  from_id     uuid        not null default auth.uid() references profiles(id) on delete cascade,
  to_id       uuid        not null references profiles(id) on delete cascade,
  -- The thread: about a cast (null = just chat), and maybe a moment in it.
  cast_id     uuid        references casts(id) on delete cascade,
  at_ms       integer     check (at_ms is null or at_ms >= 0),
  audio_path  text        not null,
  duration    integer,
  peaks       smallint[]  check (peaks is null or cardinality(peaks) <= 1000),
  created_at  timestamptz not null default now(),
  heard_at    timestamptz,
  check (from_id <> to_id)
);

create index if not exists voice_notes_to_idx on voice_notes (to_id, created_at desc);
create index if not exists voice_notes_from_idx on voice_notes (from_id, created_at desc);

-- Can this person (not necessarily the caller) see this cast? The
-- can_access_cast rule, for anyone.
create or replace function public.cast_visible_to(p_cast uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.casts c
    where c.id = p_cast and (c.creator_id = p_user or c.sharer_id = p_user)
  ) or exists (
    select 1 from public.cast_participants cp
    where cp.cast_id = p_cast and cp.profile_id = p_user
  ) or exists (
    select 1 from public.cast_recipients cr
    where cr.cast_id = p_cast and cr.recipient_id = p_user
  );
$$;

alter table voice_notes enable row level security;

drop policy if exists "voice_notes_select_own" on voice_notes;
create policy "voice_notes_select_own"
  on voice_notes for select
  to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

-- Only to someone in your address book, from your own folder, and only about
-- a cast you can both hear.
drop policy if exists "voice_notes_insert_friend" on voice_notes;
create policy "voice_notes_insert_friend"
  on voice_notes for insert
  to authenticated
  with check (
    from_id = auth.uid()
    and exists (
      select 1 from friendships f where f.user_id = auth.uid() and f.friend_id = to_id
    )
    and split_part(audio_path, '/', 1) = auth.uid()::text
    and (
      cast_id is null
      or (public.can_access_cast(cast_id) and public.cast_visible_to(cast_id, to_id))
    )
  );

-- The sender attaches the waveform once it's measured.
drop policy if exists "voice_notes_update_own_peaks" on voice_notes;
create policy "voice_notes_update_own_peaks"
  on voice_notes for update
  to authenticated
  using (from_id = auth.uid())
  with check (from_id = auth.uid());

-- Unsend.
drop policy if exists "voice_notes_delete_own" on voice_notes;
create policy "voice_notes_delete_own"
  on voice_notes for delete
  to authenticated
  using (from_id = auth.uid());

grant select, insert, delete on voice_notes to authenticated;
grant update (peaks) on voice_notes to authenticated;

-- Hearing them: the recipient marks notes heard (a whole thread, or
-- everything), via functions so they can't touch anything else.
create or replace function public.mark_notes_heard(p_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.voice_notes
  set heard_at = now()
  where id = any(p_ids) and to_id = auth.uid() and heard_at is null;
$$;

create or replace function public.mark_all_notes_heard()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.voice_notes
  set heard_at = now()
  where to_id = auth.uid() and heard_at is null;
$$;

revoke execute on function public.mark_notes_heard(uuid[]) from public, anon;
revoke execute on function public.mark_all_notes_heard() from public, anon;
revoke execute on function public.cast_visible_to(uuid, uuid) from public, anon;
grant execute on function public.mark_notes_heard(uuid[]) to authenticated;
grant execute on function public.mark_all_notes_heard() to authenticated;
grant execute on function public.cast_visible_to(uuid, uuid) to authenticated;

-- A note's audio is readable by its two people.
create or replace function public.can_access_audio(p_path text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.casts c
    where c.audio_path = p_path and public.can_access_cast(c.id)
  ) or exists (
    select 1 from public.cast_turns t
    where t.audio_path = p_path and public.can_access_cast(t.cast_id)
  ) or exists (
    select 1 from public.voice_notes n
    where n.audio_path = p_path and (n.from_id = auth.uid() or n.to_id = auth.uid())
  );
$$;

-- Notes get transcripts too (same `transcribe` function), so a thread can be
-- read at a glance.
alter table transcripts alter column cast_id drop not null;
alter table transcripts
  add column if not exists note_id uuid references voice_notes(id) on delete cascade;
create index if not exists transcripts_note_idx on transcripts (note_id);

drop policy if exists "transcripts_select_accessible" on transcripts;
create policy "transcripts_select_accessible"
  on transcripts for select
  to authenticated
  using (
    (cast_id is not null and public.can_access_cast(cast_id))
    or (
      note_id is not null and exists (
        select 1 from voice_notes n
        where n.id = note_id and (n.from_id = auth.uid() or n.to_id = auth.uid())
      )
    )
  );

-- The `transcribe` Edge Function works as service_role, which (like every
-- role here) has no table privileges until granted. It reads a cast's turns
-- and writes transcripts — nothing else.
grant select on cast_turns to service_role;
grant select, insert, update on transcripts to service_role;
