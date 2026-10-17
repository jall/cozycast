import { Platform } from 'react-native';
import { waveformFor } from './waveform';

// Real waveforms. At create time we decode the audio on the uploader's device
// and keep a small loudness envelope (`casts.peaks`: ~200 values, 0–100) so
// every card can draw the cast's true shape. Casts without peaks fall back to
// the id-seeded portrait in utils/waveform.

export const PEAK_COUNT = 200;
// Decoding resamples to this rate: plenty for a loudness envelope and keeps a
// 40-minute cast to ~80 MB of samples while we measure it.
const DECODE_RATE = 8000;
// Generous: this runs in the background and never blocks saving a cast.
const DECODE_TIMEOUT_MS = 120000;

// RMS loudness per slice of `samples`, normalised so the loudest slice is 100.
export function peaksFromSamples(samples, count = PEAK_COUNT) {
  const n = samples?.length || 0;
  if (n === 0) return null;
  const slices = Math.min(count, n);
  const out = new Array(slices);
  let max = 0;
  for (let i = 0; i < slices; i++) {
    const start = Math.floor((i * n) / slices);
    const end = Math.max(start + 1, Math.floor(((i + 1) * n) / slices));
    // Every other sample is plenty for an envelope and halves the work.
    const step = end - start > 64 ? 2 : 1;
    let sum = 0;
    let k = 0;
    for (let j = start; j < end; j += step) {
      sum += samples[j] * samples[j];
      k += 1;
    }
    const rms = Math.sqrt(sum / k);
    out[i] = rms;
    if (rms > max) max = rms;
  }
  if (max === 0) return out.map(() => 0);
  return out.map((v) => Math.round((v / max) * 100));
}

// `bars` heights (0.15–1) for a cast: its real peaks resampled to fit, or the
// seeded portrait when it has none.
export function waveformShape(peaks, seed, bars) {
  if (!Array.isArray(peaks) || peaks.length < 8) return waveformFor(seed, bars);
  const out = new Array(bars);
  for (let i = 0; i < bars; i++) {
    const start = Math.floor((i * peaks.length) / bars);
    const end = Math.max(start + 1, Math.floor(((i + 1) * peaks.length) / bars));
    let m = 0;
    for (let j = start; j < end; j++) m = Math.max(m, peaks[j] || 0);
    // Square-root scale: quiet talk stays readable next to a laugh.
    out[i] = Math.max(0.15, Math.min(1, Math.sqrt(m / 100)));
  }
  return out;
}

// Decode an audio file (a local blob/file URI, or a signed URL) and measure its
// peaks. Web only (it uses Web Audio; the decode runs off the main thread);
// resolves null anywhere else, on any failure, or if it takes too long.
export async function computePeaks(uri) {
  if (Platform.OS !== 'web' || !uri || typeof window === 'undefined') return null;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline) return null;
  const work = (async () => {
    const buffer = await (await fetch(uri)).arrayBuffer();
    const ctx = new Offline(1, 1, DECODE_RATE);
    const audio = await ctx.decodeAudioData(buffer);
    return peaksFromSamples(audio.getChannelData(0));
  })();
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), DECODE_TIMEOUT_MS));
  try {
    return await Promise.race([work, timeout]);
  } catch {
    return null;
  }
}
