import { friendTints } from '../theme/colors';
import { hash } from './castCover';

// A person's glow: a stable soft tint per name, so someone keeps the same
// colour on avatars, faces around a cast, and their note markers.
export function friendTint(name) {
  return friendTints[
    hash(
      String(name || '')
        .trim()
        .toLowerCase(),
    ) % friendTints.length
  ];
}

export function initialOf(name) {
  const c = (name || '').trim().charAt(0);
  return c ? c.toUpperCase() : '?';
}

// Everything that's passed between you (`uid`) and one person (`pid`), from
// the casts you can see — each cast in the first group it fits:
//  - fromThem: they made it or shared it, and it reached you
//  - fromYou:  you made or share it, and you shared it with them
//  - together: they're tagged as being in it
export function castsBetween(casts, pid, uid) {
  const fromThem = [];
  const fromYou = [];
  const together = [];
  (casts || []).forEach((c) => {
    const theirs = c.creator_id === pid || c.sharer_id === pid;
    const mine = c.creator_id === uid || c.sharer_id === uid;
    if (theirs && !mine) fromThem.push(c);
    else if (mine && (c.recipient_ids || []).includes(pid)) fromYou.push(c);
    else if ((c.participant_ids || []).includes(pid)) together.push(c);
  });
  return { fromThem, fromYou, together };
}

// Whose page a cast's byline should open: the person it's "by" from where you
// sit (see utils/track castBy).
export function castByIdOf(cast) {
  if (cast.shared_with_me && !cast.can_manage) return cast.sharer_id || cast.creator_id;
  return cast.creator_id;
}
