-- Pass the mic: a cast made in turns. You record a turn (ending, if you like,
-- with a question), pass the mic to someone in it, they answer in their own
-- time, and so on — one cast, many takes, played back in order. While it's
-- being made only its makers can hear it; once someone says "we're done", any
-- of them can choose who else hears it.
--
-- Alongside it, casts made together become *co-owned*: everyone tagged in a
-- cast can now manage it (choose who hears it), not just its creator or a
-- single nominated sharer. The sharer column stays for older casts.

-- ---- Casts made in turns ---------------------------------------------------

alter table casts add column if not exists together boolean not null default false;
-- Whose turn it is (null before the first turn and once it's finished).
alter table casts add column if not exists turn_with uuid references profiles(id) on delete set null;
alter table casts add column if not exists finished_at timestamptz;

-- Each turn is its own take. casts.audio_path is the first turn's audio (so
-- everything that only knows about one file still works); casts.duration is
-- the sum.
create table if not exists cast_turns (
  id         uuid        primary key default gen_random_uuid(),
  cast_id    uuid        not null references casts(id) on delete cascade,
  author_id  uuid        not null references profiles(id) on delete cascade,
  position   integer     not null,
  audio_path text        not null,
  duration   integer,
  peaks      smallint[]  check (peaks is null or cardinality(peaks) <= 1000),
  question   text        check (question is null or char_length(question) <= 500),
  created_at timestamptz not null default now(),
  unique (cast_id, position)
);

alter table cast_turns enable row level security;

drop policy if exists "cast_turns_select_accessible" on cast_turns;
create policy "cast_turns_select_accessible"
  on cast_turns for select
  to authenticated
  using (public.can_access_cast(cast_id));

-- The waveform is measured after upload and attached by the turn's author.
drop policy if exists "cast_turns_update_own_peaks" on cast_turns;
create policy "cast_turns_update_own_peaks"
  on cast_turns for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

grant select on cast_turns to authenticated;
grant update (peaks) on cast_turns to authenticated;
-- Turns are added through add_cast_turn (it checks whose turn it is).

-- ---- Who made it, who manages it -------------------------------------------

-- The people a cast belongs to: its creator and everyone tagged in it.
create or replace function public.is_cast_maker(p_cast uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.casts c where c.id = p_cast and c.creator_id = auth.uid()
  ) or exists (
    select 1 from public.cast_participants cp
    where cp.cast_id = p_cast and cp.profile_id = auth.uid()
  );
$$;

-- Managing a cast (choosing who hears it, tagging people) is now open to
-- everyone in it, plus a nominated sharer on older casts.
create or replace function public.can_manage_cast(p_cast_id uuid)
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
  ) or exists (
    select 1 from public.cast_participants cp
    where cp.cast_id = p_cast_id and cp.profile_id = auth.uid()
  );
$$;

-- Still being made in turns?
create or replace function public.cast_in_progress(p_cast uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.casts c
    where c.id = p_cast and c.together and c.finished_at is null
  );
$$;

-- Nobody else hears a cast made in turns until it's finished.
drop policy if exists "cast_recipients_insert_manage" on cast_recipients;
create policy "cast_recipients_insert_manage"
  on cast_recipients for insert
  to authenticated
  with check (
    public.can_manage_cast(cast_id)
    and shared_by = auth.uid()
    and not public.cast_in_progress(cast_id)
  );

-- Each turn's audio is readable by whoever can access its cast.
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
  );
$$;

-- ---- Taking turns ----------------------------------------------------------

-- Add your turn (the first one, as its creator, or when the mic's been passed
-- to you), then pass the mic to someone else in it — or, with no one to pass
-- to, finish it. Returns the new turn's id.
create or replace function public.add_cast_turn(
  p_cast uuid,
  p_audio_path text,
  p_duration integer,
  p_question text,
  p_pass_to uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cast public.casts%rowtype;
  v_position integer;
  v_turn uuid;
  v_question text := nullif(trim(coalesce(p_question, '')), '');
begin
  select * into v_cast from public.casts where id = p_cast for update;
  if not found or not v_cast.together then
    raise exception 'That cast isn''t being made in turns';
  end if;
  if v_cast.finished_at is not null then
    raise exception 'That cast is already finished';
  end if;
  if not public.is_cast_maker(p_cast) then
    raise exception 'Only the people in a cast can add to it';
  end if;

  select coalesce(max(position) + 1, 0) into v_position
  from public.cast_turns where cast_id = p_cast;

  if v_position = 0 then
    if v_cast.creator_id <> auth.uid() then
      raise exception 'Whoever started it goes first';
    end if;
  elsif v_cast.turn_with is distinct from auth.uid() then
    raise exception 'It isn''t your turn';
  end if;

  if p_pass_to is not null and (
    p_pass_to = auth.uid()
    or not (
      p_pass_to = v_cast.creator_id
      or exists (
        select 1 from public.cast_participants cp
        where cp.cast_id = p_cast and cp.profile_id = p_pass_to
      )
    )
  ) then
    raise exception 'Pass the mic to someone in the cast';
  end if;

  if not (split_part(p_audio_path, '/', 1) = auth.uid()::text) then
    raise exception 'That audio isn''t yours';
  end if;

  insert into public.cast_turns (cast_id, author_id, position, audio_path, duration, question)
  values (p_cast, auth.uid(), v_position, p_audio_path, p_duration, v_question)
  returning id into v_turn;

  update public.casts
  set duration = (select sum(coalesce(duration, 0)) from public.cast_turns where cast_id = p_cast),
      turn_with = p_pass_to,
      finished_at = case when p_pass_to is null then now() end
  where id = p_cast;

  if p_pass_to is not null then
    insert into public.notifications (user_id, type, cast_id, actor_id)
    values (p_pass_to, 'turn', p_cast, auth.uid());
  else
    perform public.notify_finished(p_cast);
  end if;

  return v_turn;
end;
$$;

-- "We're done": any maker can call it, whoever's turn it is.
create or replace function public.finish_together_cast(p_cast uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_cast_maker(p_cast) then
    raise exception 'Only the people in a cast can finish it';
  end if;
  update public.casts
  set finished_at = now(), turn_with = null
  where id = p_cast and together and finished_at is null;
  if found then
    perform public.notify_finished(p_cast);
  end if;
end;
$$;

-- Tell the other makers it's finished (and theirs to share).
create or replace function public.notify_finished(p_cast uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, cast_id, actor_id)
  select distinct m.uid, 'finished', p_cast, auth.uid()
  from (
    select c.creator_id as uid from public.casts c where c.id = p_cast
    union
    select cp.profile_id from public.cast_participants cp where cp.cast_id = p_cast
  ) m
  where m.uid is not null and m.uid <> auth.uid();
$$;

revoke execute on function public.add_cast_turn(uuid, text, integer, text, uuid) from public, anon;
revoke execute on function public.finish_together_cast(uuid) from public, anon;
revoke execute on function public.notify_finished(uuid) from public, anon, authenticated;
grant execute on function public.add_cast_turn(uuid, text, integer, text, uuid) to authenticated;
grant execute on function public.finish_together_cast(uuid) to authenticated;

-- ---- Notifications ---------------------------------------------------------
--   'turn'     — someone passed you the mic
--   'finished' — a cast you're making together is done (and yours to share)

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in (
    'comment', 'share', 'tagged', 'sharer', 'heard', 'ask', 'answered', 'turn', 'finished'
  ));

-- Being added to a cast made in turns is announced by the mic being passed to
-- you, not by a separate "tagged you".
create or replace function public.notify_on_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_sharer uuid;
  v_together boolean;
begin
  select creator_id, sharer_id, together into v_creator, v_sharer, v_together
  from casts where id = new.cast_id;
  if new.profile_id is not null
     and not coalesce(v_together, false)
     and new.profile_id is distinct from v_creator
     and new.profile_id is distinct from v_sharer then
    insert into notifications (user_id, type, cast_id, actor_id)
    values (new.profile_id, 'tagged', new.cast_id, v_creator);
  end if;
  return new;
end;
$$;
