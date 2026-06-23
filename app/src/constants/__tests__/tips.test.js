import { CONVERSATION_TIPS, randomTip } from '../tips';

describe('conversation tips', () => {
  it('exposes a non-empty list of prompts', () => {
    expect(Array.isArray(CONVERSATION_TIPS)).toBe(true);
    expect(CONVERSATION_TIPS.length).toBeGreaterThan(0);
    expect(CONVERSATION_TIPS.every((t) => typeof t === 'string' && t.length > 0)).toBe(true);
  });

  it('randomTip always returns one of the prompts', () => {
    for (let i = 0; i < 25; i++) {
      expect(CONVERSATION_TIPS).toContain(randomTip());
    }
  });
});
