import { hash } from './castCover';

// A cast's *shape*: a deterministic, smooth bar envelope derived from its id,
// so every card shows something to look at (and where you left off) before
// anyone presses play. It's a portrait, not an analysis — real peaks would need
// decoding the audio at upload time; this keeps the feed free of extra storage
// reads. Values are 0.15–1, gently louder through the middle like a talk.
export function waveformFor(seed, count = 48) {
  let s = hash(seed || 'cozycast') || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out = [];
  let prev = 0.5;
  for (let i = 0; i < count; i++) {
    const envelope = 0.45 + 0.55 * Math.sin((Math.PI * (i + 0.5)) / count);
    // Mostly fresh randomness with a little memory: speech-like, not static.
    prev = prev * 0.3 + rand() * 0.7;
    out.push(Math.max(0.15, Math.min(1, (0.12 + 0.88 * prev * prev) * envelope * 1.25)));
  }
  return out;
}

// m:ss (or h:mm:ss) from milliseconds, for positions and durations.
export function formatClock(millis) {
  const total = Math.max(0, Math.floor((millis || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
