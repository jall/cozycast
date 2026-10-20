-- Search: everything you can hear, by what was said in it. Postgres full-text
-- search over cast titles/summaries, notes along the way, and transcripts
-- (casts, turns and voice notes) — each transcript hit pinned to the line it's
-- in, so a result can play from that moment.
--
-- 'simple' configuration (no stemming) so it works in any language; every
-- word is a prefix match, so it finds things as you type.
--
-- SECURITY INVOKER: it runs as the caller, so the usual RLS decides what it
-- can see — search never reaches anything you couldn't open yourself.

-- "sour dou" -> 'sour':* & 'dou':*  (letters and digits only; null if empty)
create or replace function public.search_query(p_text text)
returns tsquery
language sql
immutable
set search_path = ''
as $$
  select case when count(*) = 0 then null
    else to_tsquery('simple', string_agg(quote_literal(w) || ':*', ' & '))
  end
  from (
    select w from regexp_split_to_table(lower(coalesce(p_text, '')), '[^[:alnum:]]+') as w
    where w <> ''
    limit 8
  ) words;
$$;

create index if not exists casts_search_idx on casts
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '')));

create or replace function public.search_everything(p_query text)
returns table (
  kind       text,          -- 'cast' | 'said' | 'comment' | 'note'
  cast_id    uuid,
  note_id    uuid,
  other_id   uuid,          -- for a note: the other person
  title      text,
  at_ms      integer,       -- where in the cast (or note) to start
  snippet    text,          -- matches wrapped in [[ ]]
  rank       real,
  created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  with q as (select public.search_query(p_query) as tsq),

  cast_hits as (
    select 'cast'::text as kind, c.id as cast_id, null::uuid as note_id, null::uuid as other_id,
      c.title, null::integer as at_ms,
      ts_headline('simple', coalesce(nullif(c.summary, ''), c.title), q.tsq,
        'StartSel=[[,StopSel=]],MaxWords=24,MinWords=8,HighlightAll=false') as snippet,
      (ts_rank(to_tsvector('simple', coalesce(c.title, '') || ' ' || coalesce(c.summary, '')), q.tsq) * 2)::real as rank,
      c.created_at
    from casts c, q
    where q.tsq is not null
      and to_tsvector('simple', coalesce(c.title, '') || ' ' || coalesce(c.summary, '')) @@ q.tsq
  ),

  -- Transcript lines, three per recording at most.
  lines as (
    select t.cast_id, t.note_id, t.audio_path,
      ((g->>'s')::numeric * 1000)::integer as local_ms,
      g->>'t' as line,
      ts_rank(to_tsvector('simple', g->>'t'), q.tsq) as r,
      row_number() over (
        partition by t.audio_path
        order by ts_rank(to_tsvector('simple', g->>'t'), q.tsq) desc, (g->>'s')::numeric
      ) as nth
    from transcripts t, q, jsonb_array_elements(t.segments) g
    where q.tsq is not null
      and to_tsvector('simple', t.text) @@ q.tsq
      and to_tsvector('simple', g->>'t') @@ q.tsq
  ),

  said_hits as (
    select 'said'::text, l.cast_id, null::uuid, null::uuid, c.title,
      -- A turn starts after the turns before it.
      (l.local_ms + coalesce((
        select sum(coalesce(p.duration, 0)) * 1000
        from cast_turns tt join cast_turns p on p.cast_id = tt.cast_id and p.position < tt.position
        where tt.cast_id = l.cast_id and tt.audio_path = l.audio_path
      ), 0))::integer,
      ts_headline('simple', l.line, (select tsq from q), 'StartSel=[[,StopSel=]],HighlightAll=true'),
      l.r::real, c.created_at
    from lines l join casts c on c.id = l.cast_id
    where l.nth <= 3 and l.cast_id is not null
  ),

  note_hits as (
    select 'note'::text, n.cast_id, n.id, case when n.from_id = auth.uid() then n.to_id else n.from_id end,
      c.title, l.local_ms,
      ts_headline('simple', l.line, (select tsq from q), 'StartSel=[[,StopSel=]],HighlightAll=true'),
      l.r::real, n.created_at
    from lines l join voice_notes n on n.id = l.note_id
    left join casts c on c.id = n.cast_id
    where l.nth <= 2
  ),

  comment_hits as (
    select 'comment'::text, cc.cast_id, null::uuid, cc.author_id, c.title, cc.at_ms,
      ts_headline('simple', cc.body, q.tsq, 'StartSel=[[,StopSel=]],MaxWords=24,MinWords=8'),
      ts_rank(to_tsvector('simple', cc.body), q.tsq)::real, cc.created_at
    from cast_comments cc join casts c on c.id = cc.cast_id, q
    where q.tsq is not null and to_tsvector('simple', cc.body) @@ q.tsq
  )

  select * from (
    select * from cast_hits
    union all select * from said_hits
    union all select * from note_hits
    union all select * from comment_hits
  ) hits
  order by rank desc, created_at desc
  limit 60;
$$;

revoke execute on function public.search_everything(text) from public, anon;
grant execute on function public.search_everything(text) to authenticated;
grant execute on function public.search_query(text) to authenticated;
