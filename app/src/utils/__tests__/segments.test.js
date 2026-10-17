import { segmentsFor, locate, totalOf, restack } from '../segments';

describe('segmentsFor', () => {
  it('treats a plain track as one segment', () => {
    const segs = segmentsFor({ audioPath: 'a.m4a', durationSeconds: 90 });
    expect(segs).toEqual([{ audioPath: 'a.m4a', uri: null, startMs: 0, durMs: 90000 }]);
  });

  it('stacks turns back to back', () => {
    const segs = segmentsFor({
      segments: [
        { audioPath: 'a', durationMs: 4000 },
        { audioPath: 'b', durationMs: 6000 },
        { audioPath: 'c', durationMs: 2000 },
      ],
    });
    expect(segs.map((s) => s.startMs)).toEqual([0, 4000, 10000]);
    expect(totalOf(segs)).toBe(12000);
  });
});

describe('locate', () => {
  const segs = segmentsFor({
    segments: [
      { audioPath: 'a', durationMs: 4000 },
      { audioPath: 'b', durationMs: 6000 },
    ],
  });

  it('finds the turn and how far into it', () => {
    expect(locate(segs, 0)).toEqual({ idx: 0, local: 0 });
    expect(locate(segs, 3999)).toEqual({ idx: 0, local: 3999 });
    expect(locate(segs, 4000)).toEqual({ idx: 1, local: 0 });
    expect(locate(segs, 7500)).toEqual({ idx: 1, local: 3500 });
  });

  it('clamps past the end into the last turn', () => {
    expect(locate(segs, 99999)).toEqual({ idx: 1, local: 95999 });
    expect(locate(segs, -5)).toEqual({ idx: 0, local: 0 });
  });

  it('restacks when a length turns out different', () => {
    const s = segmentsFor({
      segments: [
        { audioPath: 'a', durationMs: 4000 },
        { audioPath: 'b', durationMs: 6000 },
      ],
    });
    s[0].durMs = 5000;
    restack(s);
    expect(s[1].startMs).toBe(5000);
  });
});
