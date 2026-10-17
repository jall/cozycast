-- "Ask for a cast": send someone in your address book a prompt ("tell me
-- about your grandad's boat"); they answer it by recording a cast, which goes
-- to you. A request is visible to its two people only.

create table if not exists cast_requests (
  id               uuid        primary key default gen_random_uuid(),
  from_id          uuid        not null default auth.uid() references profiles(id) on delete cascade,
  to_id            uuid        not null references profiles(id) on delete cascade,
  prompt           text        not null check (char_length(prompt) between 1 and 500),
  created_at       timestamptz not null default now(),
  answered_cast_id uuid        references casts(id) on delete set null,
  answered_at      timestamptz,
  dismissed_at     timestamptz,
  check (from_id <> to_id)
);

create index if not exists cast_requests_to_open_idx
  on cast_requests (to_id, created_at desc)
  where answered_at is null and dismissed_at is null;

alter table cast_requests enable row level security;

drop policy if exists "cast_requests_select_own" on cast_requests;
create policy "cast_requests_select_own"
  on cast_requests for select
  to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

-- Only ask people in your address book.
drop policy if exists "cast_requests_insert_friend" on cast_requests;
create policy "cast_requests_insert_friend"
  on cast_requests for insert
  to authenticated
  with check (
    from_id = auth.uid()
    and exists (
      select 1 from friendships f where f.user_id = auth.uid() and f.friend_id = to_id
    )
  );

-- The asker can withdraw it.
drop policy if exists "cast_requests_delete_own" on cast_requests;
create policy "cast_requests_delete_own"
  on cast_requests for delete
  to authenticated
  using (from_id = auth.uid());

grant select, insert, delete on cast_requests to authenticated;

-- Answering / setting aside go through these (the asked person may only touch
-- those fields, so no direct UPDATE grant).
create or replace function public.answer_cast_request(p_request uuid, p_cast uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from uuid;
begin
  select from_id into v_from from public.cast_requests
  where id = p_request and to_id = auth.uid();
  if not found then
    raise exception 'No such request';
  end if;
  if not exists (select 1 from public.casts where id = p_cast and creator_id = auth.uid()) then
    raise exception 'You can only answer with your own cast';
  end if;

  update public.cast_requests
  set answered_cast_id = p_cast, answered_at = now()
  where id = p_request;

  -- One notification for the asker: "answered your ask" says more than the
  -- generic "shared with you" the share itself produced.
  delete from public.notifications
  where user_id = v_from and cast_id = p_cast and type = 'share';
  insert into public.notifications (user_id, type, cast_id, actor_id, request_id)
  values (v_from, 'answered', p_cast, auth.uid(), p_request);
end;
$$;

create or replace function public.dismiss_cast_request(p_request uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.cast_requests
  set dismissed_at = now()
  where id = p_request and to_id = auth.uid();
$$;

revoke execute on function public.answer_cast_request(uuid, uuid) from public, anon;
revoke execute on function public.dismiss_cast_request(uuid) from public, anon;
grant execute on function public.answer_cast_request(uuid, uuid) to authenticated;
grant execute on function public.dismiss_cast_request(uuid) to authenticated;

-- Notifications: being asked, and your ask being answered.
alter table notifications
  add column if not exists request_id uuid references cast_requests(id) on delete cascade;

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in ('comment', 'share', 'tagged', 'sharer', 'heard', 'ask', 'answered'));

create or replace function public.notify_on_ask()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, actor_id, request_id)
  values (new.to_id, 'ask', new.from_id, new.id);
  return new;
end;
$$;

drop trigger if exists trg_notify_on_ask on cast_requests;
create trigger trg_notify_on_ask
  after insert on cast_requests
  for each row execute function public.notify_on_ask();

revoke execute on function public.notify_on_ask() from anon, authenticated;
