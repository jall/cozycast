import { castProgress } from '../progress';

const cast = { id: 'c1', duration: 600 };

describe('castProgress', () => {
  it('uses the live position for the playing cast', () => {
    expect(
      castProgress(cast, { track: { id: 'c1' }, position: 30_000, duration: 590_000 }),
    ).toEqual({ isCurrent: true, total: 590_000, at: 30_000, done: false });
  });

  it('shows where you left off for a cast that is not playing', () => {
    expect(
      castProgress(cast, {
        track: null,
        progress: { c1: { pos: 120_000, dur: 600_000, done: false } },
      }),
    ).toEqual({ isCurrent: false, total: 600_000, at: 120_000, done: false });
  });

  it('banks a finished cast in full', () => {
    expect(
      castProgress(cast, { track: null, progress: { c1: { pos: 0, dur: 600_000, done: true } } }),
    ).toEqual({ isCurrent: false, total: 600_000, at: 600_000, done: true });
  });

  it('falls back to the stored duration for an unheard cast', () => {
    expect(castProgress(cast, { track: null, progress: {} })).toEqual({
      isCurrent: false,
      total: 600_000,
      at: 0,
      done: false,
    });
  });
});
