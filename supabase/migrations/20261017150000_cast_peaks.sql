-- Real waveforms: a cast's loudness envelope, computed once on the uploader's
-- device (web Audio decode at create time) and stored with the cast so every
-- card can draw its true shape before anyone presses play.
--
-- `peaks` is ~200 values, 0–100 (RMS per slice, normalised to the loudest).
-- Nullable: older casts, and uploads where decoding wasn't possible, fall back
-- to the deterministic portrait the client derives from the cast id. Written by
-- the creator/sharer under the existing casts_update_manage policy.

alter table casts
  add column if not exists peaks smallint[]
  check (peaks is null or cardinality(peaks) <= 1000);
