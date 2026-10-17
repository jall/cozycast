import { friendTints } from '../theme/colors';
import { friendTint } from './people';
import { waveformFor } from './waveform';
import { PEAK_COUNT } from './peaks';

// Casts made in turns ("pass the mic"): each turn is its own take, played back
// in order, and each maker has their own colour along the waveform.

// The people a cast belongs to: its creator, then everyone tagged in it who's
// on cozycast. [{ id, name }]
export function makersOf(cast) {
  const seen = new Set();
  const out = [];
  const add = (id, name) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: name || 'Someone' });
  };
  add(cast?.creator_id, cast?.creator_name);
  (cast?.participant_people || []).forEach((p) => add(p.id, p.name));
  return out;
}

// Warm and cool tints: makers alternate between them, so two people taking
// turns never read as one (amber beside salmon does).
const WARM = new Set(['#FFB547', '#E89A7A', '#E8C77A']);

// A colour per maker: their usual tint, unless it's taken or on the same side
// as the previous maker's — then the first free tint from the other side.
// { [id]: colour }
export function makerColors(makers) {
  const used = new Set();
  const out = {};
  let prev = null;
  (makers || []).forEach((m) => {
    let c = friendTint(m.name);
    if (used.has(c) || (prev && WARM.has(prev) === WARM.has(c))) {
      const wantWarm = prev ? !WARM.has(prev) : true;
      c =
        friendTints.find((t) => !used.has(t) && WARM.has(t) === wantWarm) ||
        friendTints.find((t) => !used.has(t)) ||
        c;
    }
    used.add(c);
    out[m.id] = c;
    prev = c;
  });
  return out;
}

// Where a cast made in turns stands, from where you sit (`uid`):
//  - 'yours'    — the mic's been passed to you
//  - 'theirs'   — someone else's turn
//  - 'finished' — done (anyone in it can share it now)
//  - null       — not a cast made in turns
export function turnState(cast, uid) {
  if (!cast?.together) return null;
  if (cast.finished_at) return 'finished';
  if (cast.turn_with && cast.turn_with === uid) return 'yours';
  return 'theirs';
}

// Still being made: only its makers can hear it, and it can't be shared yet.
export function inProgress(cast) {
  return !!cast?.together && !cast.finished_at;
}

// Whose turn it is, by name (or null).
export function turnHolder(cast) {
  if (!cast?.turn_with) return null;
  return makersOf(cast).find((m) => m.id === cast.turn_with) || null;
}

// The whole cast's shape: one waveform made of each turn's (in proportion to
// its length), with a coloured band per turn. Returns { peaks, bands } where
// bands are [{ start, end, color, authorId, name, startMs, durMs, turn }] —
// start/end as fractions of the whole. Null for a cast without turns.
export function togetherShape(cast, count = PEAK_COUNT) {
  const turns = cast?.turns || [];
  if (turns.length === 0) return null;
  const makers = makersOf(cast);
  const colours = makerColors(makers);
  const nameOf = (id) => makers.find((m) => m.id === id)?.name || 'Someone';
  const lengths = turns.map((t) => Math.max(1, (t.duration || 0) * 1000));
  const total = lengths.reduce((a, b) => a + b, 0);

  const peaks = [];
  const bands = [];
  let startMs = 0;
  turns.forEach((t, i) => {
    const n = Math.max(4, Math.round((count * lengths[i]) / total));
    peaks.push(...resample(turnPeaks(t, n), n));
    bands.push({
      start: startMs / total,
      end: (startMs + lengths[i]) / total,
      color: colours[t.author_id] || friendTint(nameOf(t.author_id)),
      authorId: t.author_id,
      name: nameOf(t.author_id),
      startMs,
      durMs: lengths[i],
      turn: t,
    });
    startMs += lengths[i];
  });
  return { peaks, bands };
}

// A turn's own peaks (0–100), or its seeded portrait in the same units.
function turnPeaks(turn, n) {
  if (Array.isArray(turn.peaks) && turn.peaks.length >= 8) return turn.peaks;
  return waveformFor(turn.id || String(turn.position), n).map((v) => Math.round(v * v * 100));
}

function resample(values, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const start = Math.floor((i * values.length) / n);
    const end = Math.max(start + 1, Math.floor(((i + 1) * values.length) / n));
    let m = 0;
    for (let j = start; j < end && j < values.length; j++) m = Math.max(m, values[j] || 0);
    out[i] = m;
  }
  return out;
}
