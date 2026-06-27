-- ============================================================
-- CozyCast: per-user "played" state (#22 — calm home / unheard casts)
-- ============================================================
-- Tracks which casts a user has listened to (opened), so the calm home can
-- surface the next *unheard* cast shared with them, and the feed can mark
-- received-but-unplayed casts distinctly. One row per (cast, user); the first
-- play wins (we don't update the timestamp).
--
-- Owner-only: you can only see and record your own plays, and only for casts
-- you can actually access (reuses can_access_cast).
-- ============================================================

create table if not exists cast_plays (
  cast_id   uuid        not null references casts(id) on delete cascade,
  user_id   uuid        not null references profiles(id) on delete cascade,
  played_at timestamptz not null default now(),
  primary key (cast_id, user_id)
);

alter table cast_plays enable row level security;

drop policy if exists "cast_plays_select_own" on cast_plays;
create policy "cast_plays_select_own"
  on cast_plays for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "cast_plays_insert_own" on cast_plays;
create policy "cast_plays_insert_own"
  on cast_plays for insert
  to authenticated
  with check (user_id = auth.uid() and public.can_access_cast(cast_id));

drop policy if exists "cast_plays_delete_own" on cast_plays;
create policy "cast_plays_delete_own"
  on cast_plays for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on cast_plays to authenticated;
