import { makersOf, makerColors, turnState, togetherShape, inProgress } from '../turns';
import { trackFor } from '../track';

const cast = {
  id: 'c1',
  title: 'What the band taught us',
  audio_path: 'jon/1.webm',
  duration: 30,
  together: true,
  creator_id: 'jon',
  creator_name: 'Jon',
  participant_people: [{ id: 'ben', name: 'Ben' }],
  turn_with: 'ben',
  turns: [
    { id: 't1', author_id: 'jon', position: 0, audio_path: 'jon/1.webm', duration: 10 },
    { id: 't2', author_id: 'ben', position: 1, audio_path: 'ben/2.webm', duration: 20 },
  ],
};

describe('makers', () => {
  it('are the creator then everyone tagged, once each', () => {
    expect(
      makersOf({ ...cast, participant_people: [...cast.participant_people, { name: 'Gran' }] }),
    ).toEqual([
      { id: 'jon', name: 'Jon' },
      { id: 'ben', name: 'Ben' },
    ]);
  });

  it('each get their own colour', () => {
    const colours = makerColors([
      { id: 'a', name: 'Same' },
      { id: 'b', name: 'Same' },
    ]);
    expect(colours.a).not.toBe(colours.b);
  });
});

describe('turnState', () => {
  it('knows whose turn it is', () => {
    expect(turnState(cast, 'ben')).toBe('yours');
    expect(turnState(cast, 'jon')).toBe('theirs');
    expect(turnState({ ...cast, finished_at: 'x', turn_with: null }, 'ben')).toBe('finished');
    expect(turnState({ ...cast, together: false }, 'ben')).toBeNull();
    expect(inProgress(cast)).toBe(true);
  });
});

describe('togetherShape', () => {
  it('splits the waveform into a band per turn, in proportion', () => {
    const { peaks, bands } = togetherShape(cast, 30);
    expect(peaks).toHaveLength(30);
    expect(bands.map((b) => [b.name, b.start, b.end])).toEqual([
      ['Jon', 0, 1 / 3],
      ['Ben', 1 / 3, 1],
    ]);
    expect(bands[1].startMs).toBe(10000);
    expect(bands[0].color).not.toBe(bands[1].color);
  });

  it('is null for a cast without turns', () => {
    expect(togetherShape({ ...cast, turns: [] })).toBeNull();
  });
});

describe('trackFor a cast made in turns', () => {
  it('plays its turns back to back', () => {
    const t = trackFor(cast);
    expect(t.segments).toEqual([
      { audioPath: 'jon/1.webm', durationMs: 10000 },
      { audioPath: 'ben/2.webm', durationMs: 20000 },
    ]);
    expect(t.durationSeconds).toBe(30);
    expect(t.bands).toHaveLength(2);
  });
});

describe('maker colours side by side', () => {
  it('never puts two warm tints next to each other', () => {
    const warm = new Set(['#FFB547', '#E89A7A', '#E8C77A']);
    const makers = ['Alice', 'Ben', 'Cleo', 'Jon', 'Rosa'].map((name) => ({ id: name, name }));
    const colours = makerColors(makers);
    const list = makers.map((m) => colours[m.id]);
    for (let i = 1; i < list.length; i++) {
      expect(warm.has(list[i]) && warm.has(list[i - 1])).toBe(false);
    }
    expect(new Set(list).size).toBe(list.length);
  });
});
