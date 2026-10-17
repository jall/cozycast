// Soft conversation tips — the manifesto's "small game", surfaced on the record
// screen as "Recording with someone? Try this:" to encourage curiosity and
// genuine listening rather than performance. Each is something to *do* in the
// conversation, in plain words.
export const CONVERSATION_TIPS = [
  'Ask one more question than feels natural.',
  'Leave a comfortable silence — let it breathe.',
  'Share something true before you ask them to.',
  'Follow the thread you’re most curious about.',
  'When you think of something clever to say, ask a question instead.',
  'Ask about the feeling, not just the facts.',
];

// A random tip — different from `previous` when one is given (the shuffle).
export function randomTip(previous) {
  const pool = CONVERSATION_TIPS.filter((t) => t !== previous);
  return pool[Math.floor(Math.random() * pool.length)];
}
