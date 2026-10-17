// How far through a cast you are, from where you sit: the live position if
// it's the one playing, else where you left off on this device (PlayerContext
// remembers it), else nothing yet. `player` is the usePlayer() value.
export function castProgress(cast, { track, position, duration, progress }) {
  const isCurrent = track?.id === cast.id;
  const saved = progress?.[cast.id];
  const total =
    isCurrent && duration ? duration : saved?.dur || (cast.duration ? cast.duration * 1000 : 0);
  const at = isCurrent ? position : saved?.done ? total : saved?.pos || 0;
  return { isCurrent, total, at, done: !isCurrent && !!saved?.done };
}
