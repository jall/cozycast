import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Waveform from './Waveform';
import SkipIcon from './SkipIcon';
import { usePlayer } from '../context/PlayerContext';
import { formatClock } from '../utils/waveform';
import { friendTint } from '../utils/people';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius, elevation } from '../theme/space';

// The full listening controls for one cast: its waveform as a scrubber (with
// any notes pinned along it as dots), elapsed / remaining / total time, and
// speed · back 15 · play · forward 30 · leave-a-note. It drives the app-wide
// player, so it works whether or not this cast is the one currently loaded —
// scrubbing a cast that isn't playing starts it from that point.
//
// `cast` is a track: { id, audioPath, title, seed, artist, durationSeconds, peaks }.
// `notes` are comments; those with `at_ms` become markers.
export default function PlayerDeck({ cast, notes = [], onNote, compact = false, style }) {
  const { track, isPlaying, position, duration, rate, toggle, play, seek, skip, cycleRate } =
    usePlayer();

  const isCurrent = track?.id === cast.id;
  const playing = isCurrent && isPlaying;
  const total = isCurrent && duration ? duration : (cast.durationSeconds || 0) * 1000;
  const at = isCurrent ? position : 0;
  const progress = total > 0 ? at / total : 0;

  function seekTo(millis) {
    if (isCurrent) seek(millis);
    else play(cast, { startMillis: millis });
  }

  const pinned =
    total > 0 ? notes.filter((n) => typeof n.at_ms === 'number' && n.at_ms <= total) : [];

  return (
    <View style={style}>
      <View style={styles.markers}>
        {pinned.map((n) => (
          <TouchableOpacity
            key={n.id}
            onPress={() => seekTo(n.at_ms)}
            accessibilityLabel={`${n.author_name} left a note at ${formatClock(n.at_ms)}`}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={[
              styles.marker,
              { left: `${(n.at_ms / total) * 100}%`, backgroundColor: friendTint(n.author_name) },
            ]}
          />
        ))}
      </View>

      <Waveform
        seed={cast.id}
        peaks={cast.peaks}
        bars={compact ? 48 : 64}
        height={compact ? 44 : 56}
        progress={progress}
        playhead
        onSeek={total > 0 ? (f) => seekTo(f * total) : undefined}
        onStep={(dir) => (isCurrent ? skip(dir * 15000) : null)}
        accessibilityValueText={`${formatClock(at)} of ${formatClock(total)}`}
      />

      <View style={styles.times}>
        <Text style={styles.time}>{formatClock(at)}</Text>
        <Text style={[styles.time, styles.timeQuiet]}>
          {total > 0 ? `${formatClock(total)} · −${formatClock(total - at)}` : ''}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={cycleRate}
          style={styles.pill}
          accessibilityLabel={`Playback speed ${rate}×`}
          activeOpacity={0.7}
        >
          <Text style={styles.pillText}>{rate}×</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => (isCurrent ? skip(-15000) : null)}
          style={styles.skip}
          accessibilityLabel="Back 15 seconds"
          disabled={!isCurrent}
          activeOpacity={0.6}
        >
          <SkipIcon seconds={15} color={isCurrent ? colors.ink : colors.inkFaint} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => toggle(cast)}
          style={[styles.play, compact && styles.playCompact]}
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          activeOpacity={0.85}
          testID="deck-play"
        >
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={compact ? 26 : 30}
            color={colors.onEmber}
            style={playing ? null : styles.playNudge}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => (isCurrent ? skip(30000) : null)}
          style={styles.skip}
          accessibilityLabel="Forward 30 seconds"
          disabled={!isCurrent}
          activeOpacity={0.6}
        >
          <SkipIcon seconds={30} forward color={isCurrent ? colors.ink : colors.inkFaint} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onNote?.(at)}
          style={styles.pill}
          accessibilityLabel={`Leave a note at ${formatClock(at)}`}
          disabled={!onNote}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chatbubble-outline"
            size={17}
            color={onNote ? colors.ink : colors.inkFaint}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  markers: {
    height: 16,
    marginBottom: space.sm,
    marginHorizontal: 1,
  },
  marker: {
    position: 'absolute',
    top: 0,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.surfaceSunk,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  time: {
    ...type.time,
    color: colors.inkSoft,
  },
  timeQuiet: {
    color: colors.inkMuted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
  },
  pill: {
    width: 52,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.smoke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    ...type.time,
    color: colors.ink,
  },
  skip: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.glow,
  },
  playCompact: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  playNudge: {
    marginLeft: 3,
  },
});
