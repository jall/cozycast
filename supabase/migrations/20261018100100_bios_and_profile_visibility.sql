-- Bios, and who can see whom.
--
-- Profiles used to be readable by every signed-in user (names *and* emails).
-- Now you can see a profile only if it's you, someone in your address book,
-- someone connected to a cast you can access (its creator, sharer, a tagged
-- participant, a commenter — or, for casts you manage, a recipient), or
-- someone you've asked / been asked for a cast by. That's everyone the app
-- ever shows you, and nobody else.

alter table profiles
  add column if not exists bio text check (bio is null or char_length(bio) <= 280);

create or replace function public.can_see_profile(p_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    p_id = auth.uid()
    or exists (
      select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = p_id
    )
    or exists (
      select 1 from public.casts c
      where (c.creator_id = p_id or c.sharer_id = p_id) and public.can_access_cast(c.id)
    )
    or exists (
      select 1 from public.cast_participants cp
      where cp.profile_id = p_id and public.can_access_cast(cp.cast_id)
    )
    or exists (
      select 1 from public.cast_comments cc
      where cc.author_id = p_id and public.can_access_cast(cc.cast_id)
    )
    or exists (
      select 1 from public.cast_recipients cr
      where cr.recipient_id = p_id and public.can_manage_cast(cr.cast_id)
    )
    or exists (
      select 1 from public.cast_requests r
      where (r.from_id = auth.uid() and r.to_id = p_id)
         or (r.to_id = auth.uid() and r.from_id = p_id)
    );
$$;

drop policy if exists "profiles_select_authenticated" on profiles;
drop policy if exists "profiles_select_visible" on profiles;
create policy "profiles_select_visible"
  on profiles for select
  to authenticated
  using (public.can_see_profile(id));
