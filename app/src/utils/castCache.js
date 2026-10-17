// Casts we've already loaded (the feed), kept so opening one paints its page
// instantly from what we know while the full detail refreshes behind it.
const cache = new Map();

export function rememberCasts(casts) {
  (casts || []).forEach((c) => c?.id && cache.set(c.id, c));
}

export function cachedCast(id) {
  return cache.get(id) || null;
}
