// Where a cast stands on being shared, from where you sit (`uid`):
//  - 'yours'   — you're its sharer and haven't chosen anyone yet (whether you
//                made it, or someone made it and asked you to share it). This
//                is what "Needs sharing" means, and it gets the nudge.
//  - 'waiting' — you made it, but asked someone else to share it, and they
//                haven't yet.
//  - null      — already shared, or not yours to share.
export function shareState(cast, uid) {
  if (!uid || cast.recipient_count > 0) return null;
  if (cast.sharer_id === uid) return 'yours';
  if (cast.creator_id === uid) return 'waiting';
  return null;
}
