// Soft conversation prompts — the manifesto's "small game", surfaced as gentle
// nudges in the app (e.g. on the record screen) to encourage curiosity and
// genuine listening rather than performance.
export const CONVERSATION_TIPS = [
  'Ask one more question than feels natural.',
  'Leave a comfortable silence — let it breathe.',
  'Share something true before you ask them to.',
  'Follow the thread you’re most curious about.',
  'Swap the next clever thing to say for really listening.',
  'Ask about the feeling, not just the facts.',
];

export function randomTip() {
  return CONVERSATION_TIPS[Math.floor(Math.random() * CONVERSATION_TIPS.length)];
}
