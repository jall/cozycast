-- Notes "along the way": a comment can be pinned to a moment in the cast.
--
-- `at_ms` is where in the audio (milliseconds from the start) the note was
-- left. Nullable — a plain comment about the whole cast has no moment. The
-- player draws pinned notes as dots on the scrubber and lets anyone with
-- access jump straight to them. RLS is unchanged: the existing
-- cast_comments policies (can_access_cast / can_manage_cast) cover the column.

alter table cast_comments
  add column if not exists at_ms integer
  check (at_ms is null or at_ms >= 0);
