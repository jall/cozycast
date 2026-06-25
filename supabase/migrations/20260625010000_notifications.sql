-- ============================================================
-- CozyCast: in-app notifications (#15, in-app half)
-- ============================================================
-- An inbox of things that happened to casts you're part of. Rows are written by
-- SECURITY DEFINER triggers (not clients) so a notification can be created for
-- *another* user without giving anyone write access to others' inboxes.
--
-- Surfaced today as a simple bell + list; the same table can feed a calmer
-- "your next unread cast" home later — the data model is the durable part.
-- Push delivery (web/native) is a separate tranche, layered on top.
--
-- Types: 'comment' (someone commented on a cast you're part of) and 'share' (a
-- cast was shared with you). 'reaction' etc. can be added when those features
-- land.
-- ============================================================

create table if not exists notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references profiles(id) on delete cascade, -- recipient
  type       text        not null check (type in ('comment', 'share')),
  cast_id    uuid        references casts(id) on delete cascade,
  actor_id   uuid        references profiles(id) on delete set null,
  comment_id uuid        references cast_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

-- The common query: my notifications, newest first (and unread filtering).
create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

-- ============================================================
-- RLS — you only ever see and manage your own inbox. No INSERT policy: rows are
-- created exclusively by the SECURITY DEFINER triggers below.
-- ============================================================
alter table notifications enable row level security;

drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own"
  on notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own"
  on notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on notifications;
create policy "notifications_delete_own"
  on notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- SELECT/UPDATE(mark read)/DELETE for the owner; INSERT only via triggers.
grant select, update, delete on notifications to authenticated;

-- ============================================================
-- Trigger: a new comment notifies everyone involved in the cast — its creator,
-- its sharer, anyone tagged as a participant, and anyone who has already
-- commented — except the author themselves. (Passive recipients aren't pinged
-- for every comment, to keep it calm.)
-- ============================================================
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, cast_id, actor_id, comment_id)
  select distinct involved.uid, 'comment', new.cast_id, new.author_id, new.id
  from (
    select c.creator_id as uid from casts c where c.id = new.cast_id
    union
    select c.sharer_id from casts c where c.id = new.cast_id
    union
    select cp.profile_id from cast_participants cp where cp.cast_id = new.cast_id
    union
    select cc.author_id from cast_comments cc where cc.cast_id = new.cast_id
  ) involved
  where involved.uid is not null
    and involved.uid <> new.author_id;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_comment on cast_comments;
create trigger trg_notify_on_comment
  after insert on cast_comments
  for each row execute function public.notify_on_comment();

-- ============================================================
-- Trigger: sharing a cast with someone notifies that recipient (unless they
-- shared it with themselves).
-- ============================================================
create or replace function public.notify_on_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recipient_id is not null and new.recipient_id is distinct from new.shared_by then
    insert into notifications (user_id, type, cast_id, actor_id)
    values (new.recipient_id, 'share', new.cast_id, new.shared_by);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_share on cast_recipients;
create trigger trg_notify_on_share
  after insert on cast_recipients
  for each row execute function public.notify_on_share();

-- Triggers run as SECURITY DEFINER (table owner); they must not be executable as
-- RPCs by clients.
revoke execute on function public.notify_on_comment() from anon, authenticated;
revoke execute on function public.notify_on_share() from anon, authenticated;
