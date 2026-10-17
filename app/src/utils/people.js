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
