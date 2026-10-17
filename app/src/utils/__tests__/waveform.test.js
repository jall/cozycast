import { waveformFor, formatClock } from '../waveform';

describe('waveformFor', () => {
  it('is deterministic per cast', () => {
    expect(waveformFor('cast-a', 40)).toEqual(waveformFor('cast-a', 40));
    expect(waveformFor('cast-a', 40)).not.toEqual(waveformFor('cast-b', 40));
  });

  it('returns the requested number of bars, all within 0.15–1', () => {
    const bars = waveformFor('cast-a', 64);
    expect(bars).toHaveLength(64);
    bars.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0.15);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it('still draws a shape with no seed', () => {
    expect(waveformFor(undefined, 8)).toHaveLength(8);
  });
});

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(61_000)).toBe('1:01');
    expect(formatClock(1_122_400)).toBe('18:42');
  });

  it('adds hours for long casts', () => {
    expect(formatClock(3_725_000)).toBe('1:02:05');
  });

  it('treats missing or negative input as zero', () => {
    expect(formatClock(undefined)).toBe('0:00');
    expect(formatClock(-5000)).toBe('0:00');
  });
});
