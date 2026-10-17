-- Casts made together belong to everyone in them: anyone tagged in a cast
-- (as well as its creator and sharer) can fix its title and summary. Who
-- *hears* it is still the sharer's call — that's the heart of the sharing
-- model — so this only touches the words, through a function rather than a
-- broader UPDATE policy (which can't limit columns).

create or replace function public.update_cast_words(p_cast uuid, p_title text, p_summary text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(trim(p_title), '') = '' then
    raise exception 'A cast needs a title';
  end if;
  if not (
    public.can_manage_cast(p_cast)
    or exists (
      select 1 from public.cast_participants cp
      where cp.cast_id = p_cast and cp.profile_id = auth.uid()
    )
  ) then
    raise exception 'Only the people in a cast can edit it';
  end if;

  update public.casts
  set title = trim(p_title),
      summary = nullif(trim(coalesce(p_summary, '')), '')
  where id = p_cast;
end;
$$;

revoke execute on function public.update_cast_words(uuid, text, text) from public, anon;
grant execute on function public.update_cast_words(uuid, text, text) to authenticated;
