// Search results come back with matches wrapped in [[ ]] (see
// search_everything). Split a snippet into [{ text, hit }] runs to draw.
export function snippetRuns(snippet) {
  const out = [];
  const re = /\[\[(.*?)\]\]/g;
  let last = 0;
  let m;
  const s = snippet || '';
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), hit: false });
    out.push({ text: m[1], hit: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), hit: false });
  return out;
}

// Where a result goes when tapped: a cast (at its moment, if it has one) or
// the voice note's conversation.
export function resultHref(r) {
  if (r.kind === 'note') return `/notes/${r.other_id}`;
  return r.at_ms != null ? `/cast/${r.cast_id}?at=${r.at_ms}` : `/cast/${r.cast_id}`;
}
