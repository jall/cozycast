import { peaksFromSamples, waveformShape, computePeaks, PEAK_COUNT } from '../peaks';
import { waveformFor } from '../waveform';

describe('peaksFromSamples', () => {
  it('measures RMS loudness per slice, normalised to 100', () => {
    // Quiet first half, loud second half.
    const samples = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) samples[i] = (i < 500 ? 0.1 : 0.5) * (i % 2 ? 1 : -1);
    const peaks = peaksFromSamples(samples, 10);
    expect(peaks).toHaveLength(10);
    expect(peaks.slice(0, 5)).toEqual([20, 20, 20, 20, 20]);
    expect(peaks.slice(5)).toEqual([100, 100, 100, 100, 100]);
  });

  it('defaults to PEAK_COUNT slices', () => {
    expect(peaksFromSamples(new Float32Array(10_000).fill(0.3))).toHaveLength(PEAK_COUNT);
  });

  it('handles silence and empty input', () => {
    expect(peaksFromSamples(new Float32Array(100), 4)).toEqual([0, 0, 0, 0]);
    expect(peaksFromSamples(new Float32Array(0))).toBeNull();
  });
});

describe('waveformShape', () => {
  it('resamples real peaks to the bar count (loudest in each span, sqrt-scaled)', () => {
    const peaks = [10, 90, 20, 40, 100, 0, 50, 50];
    const shape = waveformShape(peaks, 'c1', 4);
    [0.9, 0.4, 1, 0.5].forEach((v, i) => expect(shape[i]).toBeCloseTo(Math.sqrt(v)));
  });

  it('keeps quiet bars visible', () => {
    expect(waveformShape(new Array(8).fill(0), 'c1', 4)).toEqual([0.15, 0.15, 0.15, 0.15]);
  });

  it('falls back to the seeded portrait without peaks', () => {
    expect(waveformShape(null, 'c1', 12)).toEqual(waveformFor('c1', 12));
    expect(waveformShape([1, 2], 'c1', 12)).toEqual(waveformFor('c1', 12));
  });
});

describe('computePeaks', () => {
  it('is a no-op off the web', async () => {
    await expect(computePeaks('file:///a.m4a')).resolves.toBeNull();
  });
});
