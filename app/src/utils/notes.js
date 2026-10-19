// Voice notes, organised the way you read them: a conversation per person,
// and within it a thread per cast you're talking about (or just chat).

export const CHAT = 'chat';

export function threadKey(note) {
  return note.cast_id || CHAT;
}

// [{ personId, notes, last, unheard, waitingOnYou, threads }] — most recent
// conversation first. `notes` is oldest-first, as from getVoiceNotes.
//  - unheard:      notes to you not yet heard
//  - waitingOnYou: they spoke last (you haven't answered)
//  - threads:      [{ key, castId, castTitle, notes, last, unheard }], newest first
export function conversations(notes, uid) {
  const byPerson = new Map();
  (notes || []).forEach((n) => {
    const other = n.from_id === uid ? n.to_id : n.from_id;
    if (!byPerson.has(other)) byPerson.set(other, []);
    byPerson.get(other).push(n);
  });
  const out = [];
  byPerson.forEach((list, personId) => {
    const byThread = new Map();
    list.forEach((n) => {
      const k = threadKey(n);
      if (!byThread.has(k)) byThread.set(k, []);
      byThread.get(k).push(n);
    });
    const threads = [...byThread.entries()]
      .map(([key, ns]) => ({
        key,
        castId: key === CHAT ? null : key,
        castTitle: key === CHAT ? null : ns.find((n) => n.cast_title)?.cast_title || 'a cast',
        notes: ns,
        last: ns[ns.length - 1],
        unheard: ns.filter((n) => n.to_id === uid && !n.heard_at).length,
      }))
      .sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
    const last = list[list.length - 1];
    out.push({
      personId,
      notes: list,
      last,
      unheard: list.filter((n) => n.to_id === uid && !n.heard_at).length,
      waitingOnYou: last.from_id !== uid,
      threads,
    });
  });
  return out.sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
}

// Which conversations a filter shows: 'unheard', 'waiting', or 'all'.
export function filterConversations(list, filter) {
  if (filter === 'unheard') return list.filter((c) => c.unheard > 0);
  if (filter === 'waiting') return list.filter((c) => c.waitingOnYou);
  return list;
}

// One line on where a conversation stands, from where you sit.
export function conversationState(c, uid) {
  if (c.unheard > 0) return { text: `${c.unheard} new`, tone: 'new' };
  if (c.waitingOnYou) return { text: 'Waiting on you', tone: 'new' };
  if (c.last.from_id === uid) {
    return c.last.heard_at
      ? { text: 'They heard it ✓', tone: 'done' }
      : { text: 'Sent', tone: 'quiet' };
  }
  return { text: 'All heard', tone: 'quiet' };
}
