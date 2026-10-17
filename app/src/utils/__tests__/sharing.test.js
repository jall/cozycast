import { shareState } from '../sharing';

const me = 'u-me';

describe('shareState', () => {
  it('is yours when you made it, unshared', () => {
    expect(shareState({ creator_id: me, sharer_id: me, recipient_count: 0 }, me)).toBe('yours');
  });

  it('is yours when someone else made it and asked you to share it', () => {
    expect(shareState({ creator_id: 'u-ben', sharer_id: me, recipient_count: 0 }, me)).toBe(
      'yours',
    );
  });

  it('is yours when you are in it — casts made together belong to everyone in them', () => {
    expect(
      shareState(
        { creator_id: 'u-ben', sharer_id: 'u-ben', participant_ids: [me], recipient_count: 0 },
        me,
      ),
    ).toBe('yours');
  });

  it('waits until a cast made in turns is finished', () => {
    const cast = { creator_id: me, sharer_id: me, recipient_count: 0, together: true };
    expect(shareState(cast, me)).toBeNull();
    expect(shareState({ ...cast, finished_at: '2026-10-19T10:00:00Z' }, me)).toBe('yours');
  });

  it('is settled once shared, or when it is not yours at all', () => {
    expect(shareState({ creator_id: me, sharer_id: me, recipient_count: 2 }, me)).toBeNull();
    expect(
      shareState({ creator_id: 'u-ben', sharer_id: 'u-cleo', recipient_count: 0 }, me),
    ).toBeNull();
    expect(shareState({ creator_id: me, sharer_id: me, recipient_count: 0 }, null)).toBeNull();
  });
});
