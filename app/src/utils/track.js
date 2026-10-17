// Who a cast is "by" from where you sit: the person who shared it with you, or
// its creator — including when someone else made it and asked *you* to share
// it (you manage it, but it's still theirs).
export function castBy(cast) {
  if (cast.shared_with_me && !cast.can_manage) return cast.sharer_name || cast.creator_name;
  return cast.creator_name;
}

// The player's track object for a cast (see PlayerContext).
export function trackFor(cast) {
  return {
    id: cast.id,
    audioPath: cast.audio_path,
    title: cast.title,
    seed: cast.id,
    artist: castBy(cast),
    durationSeconds: cast.duration,
  };
}
