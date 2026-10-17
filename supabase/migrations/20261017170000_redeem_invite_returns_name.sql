-- Invite links: redeem_invite now returns the inviter's name, so the app can
-- say "You're connected with Ben" when someone follows a link. Same checks and
-- effects as before (lock the row, refuse used/own codes, mark used, add the
-- friendship both ways); the return type changes, so drop and recreate.

drop function if exists public.redeem_invite(text);

create function public.redeem_invite(invite_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
  v_name text;
begin
  select creator_id into v_creator_id
  from public.invites
  where code = upper(trim(invite_code))
    and used_by is null
  for update;

  if not found then
    raise exception 'Invalid or already-used invite code';
  end if;

  if v_creator_id = auth.uid() then
    raise exception 'You cannot redeem your own invite';
  end if;

  update public.invites
  set used_by = auth.uid(),
      used_at = now()
  where code = upper(trim(invite_code));

  insert into public.friendships (user_id, friend_id)
  values (auth.uid(), v_creator_id),
         (v_creator_id, auth.uid())
  on conflict do nothing;

  select name into v_name from public.profiles where id = v_creator_id;
  return v_name;
end;
$$;

revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;
