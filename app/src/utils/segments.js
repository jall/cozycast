// A track is played as one or more segments, back to back — a cast made in
// turns is several takes (see utils/turns). Times here are in milliseconds,
// "global" meaning across the whole track.

// [{ audioPath, uri, startMs, durMs }] for a track: its `segments`, or the
// single file it has.
export function segmentsFor(track) {
  const list =
    Array.isArray(track?.segments) && track.segments.length > 0
      ? track.segments
      : [
          {
            audioPath: track?.audioPath,
            uri: track?.uri,
            durationMs: track?.durationSeconds ? track.durationSeconds * 1000 : 0,
          },
        ];
  return restack(
    list.map((s) => ({
      audioPath: s.audioPath || null,
      uri: s.uri || null,
      startMs: 0,
      durMs: s.durationMs > 0 ? s.durationMs : 0,
    })),
  );
}

// Recompute each segment's start from the lengths before it (after a length
// turns out different once its audio loads).
export function restack(segs) {
  let start = 0;
  segs.forEach((s) => {
    s.startMs = start;
    start += s.durMs;
  });
  return segs;
}

export function totalOf(segs) {
  return (segs || []).reduce((sum, s) => sum + s.durMs, 0);
}

// Which segment a global time falls in, and how far into it.
export function locate(segs, ms) {
  const n = segs?.length || 0;
  if (n === 0) return { idx: 0, local: 0 };
  const at = Math.max(0, ms || 0);
  for (let i = 0; i < n; i++) {
    const s = segs[i];
    if (at < s.startMs + s.durMs || i === n - 1) {
      return { idx: i, local: Math.max(0, at - s.startMs) };
    }
  }
  return { idx: n - 1, local: 0 };
}
