-- Transcripts: what was said in each recording, with timings, so a cast can
-- be read along with, skimmed, and (later) searched. One per audio file — a
-- plain cast's audio, or each turn of a cast made in turns.
--
-- Written only by the `transcribe` Edge Function (service role), which a
-- client asks to run after saving a cast or a turn. Readable by whoever can
-- access the cast, like everything else about it. Kept out of `casts` so the
-- feed never drags transcripts along.

create table if not exists transcripts (
  audio_path text        primary key,
  cast_id    uuid        not null references casts(id) on delete cascade,
  -- [{ s, e, t }]: start/end seconds and the words in between.
  segments   jsonb       not null default '[]'::jsonb,
  text       text        not null default '',
  language   text,
  created_at timestamptz not null default now()
);

create index if not exists transcripts_cast_idx on transcripts (cast_id);
-- For search, later: 'simple' so it works in any language.
create index if not exists transcripts_text_idx
  on transcripts using gin (to_tsvector('simple', text));

alter table transcripts enable row level security;

drop policy if exists "transcripts_select_accessible" on transcripts;
create policy "transcripts_select_accessible"
  on transcripts for select
  to authenticated
  using (public.can_access_cast(cast_id));

grant select on transcripts to authenticated;
