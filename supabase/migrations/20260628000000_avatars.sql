-- ============================================================
-- Profile pictures (avatars)
-- ============================================================
-- Users can set an avatar shown on their profile, comments, and casts.
-- The image lives in the public `avatars` storage bucket (declared in
-- config.toml); `profiles.avatar_path` points at the object so the client can
-- derive a stable public URL. A null path means "no avatar — show initials".

alter table profiles
  add column if not exists avatar_path text;

-- ---- avatars storage policies ----
-- Object paths are "<uid>/<timestamp>.<ext>", so the first folder segment is
-- the owner's user id (same convention as the casts bucket). The bucket is
-- public, so reads are served via the public endpoint without RLS — we only
-- need to gate writes to each user's own folder. Uploads use a unique filename
-- per change (cache-busting), so a plain insert suffices; the previous file is
-- removed best-effort by the client, which the delete policy permits.

create policy "avatars_objects_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_objects_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
