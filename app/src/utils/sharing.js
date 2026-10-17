// Where a cast stands on being shared, from where you sit (`uid`):
//  - 'yours' — it's yours to share (you made it, you're in it, or you were
//              asked to share it) and nobody else has been chosen yet. This is
//              what "Needs sharing" means, and it gets the nudge.
//  - null    — already shared, not yours to share, or still being made in
//              turns (nobody else hears it until it's finished).
export function shareState(cast, uid) {
  if (!uid || cast.recipient_count > 0) return null;
  if (cast.together && !cast.finished_at) return null;
  const yours =
    cast.creator_id === uid || cast.sharer_id === uid || (cast.participant_ids || []).includes(uid);
  return yours ? 'yours' : null;
}
