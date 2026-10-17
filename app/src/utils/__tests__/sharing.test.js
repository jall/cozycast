import { shareState } from '../sharing';

const me = 'u-me';

describe('shareState', () => {
  it('is yours when you made it and are its sharer, unshared', () => {
    expect(shareState({ creator_id: me, sharer_id: me, recipient_count: 0 }, me)).toBe('yours');
  });

  it('is yours when someone else made it and asked you to share it', () => {
    expect(shareState({ creator_id: 'u-ben', sharer_id: me, recipient_count: 0 }, me)).toBe(
      'yours',
    );
  });

  it('is waiting when you made it but someone else is sharing it', () => {
    expect(shareState({ creator_id: me, sharer_id: 'u-ben', recipient_count: 0 }, me)).toBe(
      'waiting',
    );
  });

  it('is settled once shared, or when it is not yours at all', () => {
    expect(shareState({ creator_id: me, sharer_id: me, recipient_count: 2 }, me)).toBeNull();
    expect(
      shareState({ creator_id: 'u-ben', sharer_id: 'u-cleo', recipient_count: 0 }, me),
    ).toBeNull();
    expect(shareState({ creator_id: me, sharer_id: me, recipient_count: 0 }, null)).toBeNull();
  });
});
