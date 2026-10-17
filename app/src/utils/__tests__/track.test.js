import { castBy, trackFor } from '../track';
import { friendTint, initialOf } from '../people';
import { coverFor } from '../castCover';
import { friendTints } from '../../theme/colors';

const base = { id: 'c1', title: 'T', audio_path: 'a/c1.m4a', duration: 90 };

describe('castBy', () => {
  it('is the creator for your own cast', () => {
    expect(castBy({ ...base, shared_with_me: false, creator_name: 'Alice' })).toBe('Alice');
  });

  it('is the sharer for a cast shared with you', () => {
    expect(
      castBy({ ...base, shared_with_me: true, creator_name: 'Ben', sharer_name: 'Cleo' }),
    ).toBe('Cleo');
  });

  it('stays the creator when they asked you to share it', () => {
    expect(
      castBy({
        ...base,
        shared_with_me: true,
        can_manage: true,
        creator_name: 'Ben',
        sharer_name: 'Alice',
      }),
    ).toBe('Ben');
  });
});

describe('trackFor', () => {
  it('builds the player track from a cast', () => {
    expect(trackFor({ ...base, shared_with_me: false, creator_name: 'Alice' })).toEqual({
      id: 'c1',
      audioPath: 'a/c1.m4a',
      title: 'T',
      seed: 'c1',
      artist: 'Alice',
      durationSeconds: 90,
      peaks: null,
    });
  });
});

describe('people', () => {
  it('gives each person a stable glow from the palette', () => {
    expect(friendTint('Ben')).toBe(friendTint(' ben '));
    expect(friendTints).toContain(friendTint('Cleo'));
  });

  it('takes an initial, or ? for no name', () => {
    expect(initialOf('cleo')).toBe('C');
    expect(initialOf('')).toBe('?');
  });
});

describe('coverFor', () => {
  it('is a deterministic night scene', () => {
    const a = coverFor('c1');
    expect(coverFor('c1')).toEqual(a);
    expect(a.far).toMatch(/^M0 \d+ Q25/);
    expect(a.moonX).toBeGreaterThanOrEqual(22);
    expect(a.moonX).toBeLessThanOrEqual(76);
  });
});
