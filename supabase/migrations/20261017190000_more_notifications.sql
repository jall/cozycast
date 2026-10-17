-- More reasons to hear from the app, all about people (never metrics):
--   'tagged' — someone tagged you as being in a cast they recorded
--   'sharer' — someone asked you to be the one who shares their cast
--   'heard'  — someone listened to a cast you made or are sharing (first time)
-- Same shape as the comment/share notifications: SECURITY DEFINER triggers
-- write rows for the recipient; RLS keeps them owner-only.

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in ('comment', 'share', 'tagged', 'sharer', 'heard'));

-- Asked to share: on create, or when the sharer changes.
create or replace function public.notify_on_sharer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sharer_id is not null
     and new.sharer_id is distinct from new.creator_id
     and (tg_op = 'INSERT' or new.sharer_id is distinct from old.sharer_id) then
    insert into notifications (user_id, type, cast_id, actor_id)
    values (new.sharer_id, 'sharer', new.id, new.creator_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_sharer on casts;
create trigger trg_notify_on_sharer
  after insert or update of sharer_id on casts
  for each row execute function public.notify_on_sharer();

-- Tagged in a cast. The sharer already hears about it via 'sharer', and you
-- don't need telling you're in your own cast.
create or replace function public.notify_on_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_sharer uuid;
begin
  select creator_id, sharer_id into v_creator, v_sharer from casts where id = new.cast_id;
  if new.profile_id is not null
     and new.profile_id is distinct from v_creator
     and new.profile_id is distinct from v_sharer then
    insert into notifications (user_id, type, cast_id, actor_id)
    values (new.profile_id, 'tagged', new.cast_id, v_creator);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_tag on cast_participants;
create trigger trg_notify_on_tag
  after insert on cast_participants
  for each row execute function public.notify_on_tag();

-- Someone listened (cast_plays is first-play-only per person). Tell the
-- creator and, if different, the sharer — never the listener themselves.
create or replace function public.notify_on_heard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, cast_id, actor_id)
  select distinct who.uid, 'heard', new.cast_id, new.user_id
  from (
    select c.creator_id as uid from casts c where c.id = new.cast_id
    union
    select c.sharer_id from casts c where c.id = new.cast_id
  ) who
  where who.uid is not null and who.uid <> new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_heard on cast_plays;
create trigger trg_notify_on_heard
  after insert on cast_plays
  for each row execute function public.notify_on_heard();

revoke execute on function public.notify_on_sharer() from anon, authenticated;
revoke execute on function public.notify_on_tag() from anon, authenticated;
revoke execute on function public.notify_on_heard() from anon, authenticated;
