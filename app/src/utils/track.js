import { togetherShape } from './turns';

// Who a cast is "by" from where you sit: the person who shared it with you, or
// its creator — including when someone else made it and asked *you* to share
// it (you manage it, but it's still theirs).
export function castBy(cast) {
  if (cast.shared_with_me && !cast.can_manage) return cast.sharer_name || cast.creator_name;
  return cast.creator_name;
}

// The player's track object for a cast (see PlayerContext); carries the
// cast's measured waveform so the player can draw it. A cast made in turns
// plays its turns back to back, and draws them as coloured bands.
export function trackFor(cast) {
  const track = {
    id: cast.id,
    audioPath: cast.audio_path,
    title: cast.title,
    seed: cast.id,
    artist: castBy(cast),
    durationSeconds: cast.duration,
    peaks: cast.peaks || null,
  };
  const shape = togetherShape(cast);
  if (!shape) return track;
  return {
    ...track,
    durationSeconds: cast.turns.reduce((sum, t) => sum + (t.duration || 0), 0) || cast.duration,
    peaks: shape.peaks,
    bands: shape.bands,
    segments: cast.turns.map((t) => ({
      audioPath: t.audio_path,
      durationMs: (t.duration || 0) * 1000,
    })),
  };
}
