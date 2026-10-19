import { conversations, filterConversations, conversationState, CHAT } from '../notes';

const me = 'me';
const n = (id, from, to, at, extra = {}) => ({
  id,
  from_id: from,
  to_id: to,
  created_at: `2026-10-19T10:${String(at).padStart(2, '0')}:00Z`,
  heard_at: null,
  cast_id: null,
  ...extra,
});

// Oldest first, as getVoiceNotes returns them.
const notes = [
  n('5', 'cleo', me, 0, { heard_at: 'x' }),
  n('1', me, 'ben', 1, { heard_at: 'x' }),
  n('2', 'ben', me, 2, { cast_id: 'c1', cast_title: 'Grandad’s boat', at_ms: 362000 }),
  n('3', 'ben', me, 3),
  n('4', me, 'cleo', 4),
];

describe('conversations', () => {
  const list = conversations(notes, me);

  it('groups by person, most recent first', () => {
    expect(list.map((c) => c.personId)).toEqual(['cleo', 'ben']);
  });

  it('splits a person into threads per cast, plus just chat', () => {
    const ben = list.find((c) => c.personId === 'ben');
    expect(ben.threads.map((t) => t.key)).toEqual([CHAT, 'c1']);
    expect(ben.threads[1].castTitle).toBe('Grandad’s boat');
    expect(ben.unheard).toBe(2);
    expect(ben.waitingOnYou).toBe(true);
  });

  it('filters', () => {
    expect(filterConversations(list, 'unheard').map((c) => c.personId)).toEqual(['ben']);
    expect(filterConversations(list, 'waiting').map((c) => c.personId)).toEqual(['ben']);
    expect(filterConversations(list, 'all')).toHaveLength(2);
  });

  it('says where each stands', () => {
    expect(conversationState(list[1], me).text).toBe('2 new');
    expect(conversationState(list[0], me).text).toBe('Sent');
    const heard = conversations([n('9', me, 'ben', 1, { heard_at: 'x' })], me)[0];
    expect(conversationState(heard, me).text).toBe('They heard it ✓');
  });
});
