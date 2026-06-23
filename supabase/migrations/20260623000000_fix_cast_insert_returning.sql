-- ============================================================
-- Fix: creating a cast failed with
--   "new row violates row-level security policy for table casts"
-- ============================================================
-- PostgREST returns the inserted row via INSERT ... RETURNING (that's what
-- `.insert(...).select()` compiles to), which makes Postgres evaluate the
-- table's SELECT policy against the just-inserted row.
--
-- The explicit-sharing migration set that SELECT policy to can_access_cast(id),
-- which re-queries the casts table for the row. But a freshly inserted row is
-- not visible to that (stable, security-definer) function's snapshot mid-INSERT,
-- so it returned false and the whole insert was rejected — even though the row
-- was perfectly valid and the INSERT WITH CHECK (creator_id = auth.uid()) passed.
--
-- Fix: check creator/sharer directly off the new row's own columns so the
-- creator can always read back what they just inserted, and only fall back to
-- can_access_cast for the participant/recipient cases (those reference rows that
-- already exist, so the self-query is fine there). Access semantics are
-- unchanged — this just adds the two direct disjuncts can_access_cast already
-- checks internally.
drop policy if exists "casts_select_accessible" on casts;
create policy "casts_select_accessible"
  on casts for select
  to authenticated
  using (
    creator_id = auth.uid()
    or sharer_id = auth.uid()
    or public.can_access_cast(id)
  );
