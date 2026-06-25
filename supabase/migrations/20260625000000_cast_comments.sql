-- ============================================================
-- CozyCast: comments on casts (#12)
-- ============================================================
-- A lightweight conversation thread per cast. Anyone who can access a cast
-- (creator, sharer, participant, recipient) can read and post comments; a
-- comment can be removed by its author or by someone who manages the cast
-- (creator/sharer) for moderation. No edit for now — delete + repost.
--
-- Access reuses the existing SECURITY DEFINER helpers (can_access_cast /
-- can_manage_cast) so the cross-table checks don't recurse.
-- ============================================================

create table if not exists cast_comments (
  id         uuid        primary key default gen_random_uuid(),
  cast_id    uuid        not null references casts(id) on delete cascade,
  author_id  uuid        not null references profiles(id) on delete cascade,
  body       text        not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists cast_comments_cast_id_created_idx
  on cast_comments (cast_id, created_at);

-- ============================================================
-- RLS
-- ============================================================
alter table cast_comments enable row level security;

-- Read: anyone who can access the cast.
drop policy if exists "cast_comments_select_accessible" on cast_comments;
create policy "cast_comments_select_accessible"
  on cast_comments for select
  to authenticated
  using (public.can_access_cast(cast_id));

-- Post: anyone who can access the cast, writing as themselves.
drop policy if exists "cast_comments_insert_accessible" on cast_comments;
create policy "cast_comments_insert_accessible"
  on cast_comments for insert
  to authenticated
  with check (public.can_access_cast(cast_id) and author_id = auth.uid());

-- Remove: the comment's author, or whoever manages the cast (moderation).
drop policy if exists "cast_comments_delete_author_or_manager" on cast_comments;
create policy "cast_comments_delete_author_or_manager"
  on cast_comments for delete
  to authenticated
  using (author_id = auth.uid() or public.can_manage_cast(cast_id));

-- ============================================================
-- GRANTS
-- ============================================================
-- RLS is checked after table privileges, so the new table needs explicit
-- grants for the authenticated role.
grant select, insert, delete on cast_comments to authenticated;
