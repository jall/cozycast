import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { space, radius, elevation } from '../theme/space';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';

function formatTime(millis) {
  if (!millis || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// The play control on a CastCard (variant="card") and the cast detail page
// (variant="hero"). It owns no audio — it reflects and drives the app-wide
// player (PlayerContext), so only one cast plays at a time and playback
// survives scrolling/tab switches via the MiniPlayer.
//
// At rest a card shows just the play button and a quiet duration — the
// progress track (a meter reading 0:00 before anyone pressed anything) only
// appears while this cast is the one playing. The hero adds a taller,
// seekable track and a skip-back control: it's an audio app, so the one
// place you settle in to listen gets the most generous player.
export default function AudioPlayer({
  uri,
  audioPath,
  style,
  castId,
  title,
  seed,
  artist,
  durationSeconds,
  variant = 'card',
}) {
  const { track, isPlaying, position, duration, toggle, seek } = usePlayer();
  const trackWidth = useRef(0);

  const id = castId ?? uri ?? audioPath;
  const isCurrent = track?.id === id;
  const playing = isCurrent && isPlaying;
  const hero = variant === 'hero';

  const displayPosition = isCurrent ? position : 0;
  const displayDuration =
    isCurrent && duration ? duration : durationSeconds ? durationSeconds * 1000 : 0;
  const progress = displayDuration > 0 ? displayPosition / displayDuration : 0;

  function handlePlayPause() {
    toggle({ id, uri, audioPath, title, seed, artist, durationSeconds });
  }

  function handleSeek(e) {
    if (!isCurrent || !displayDuration || !trackWidth.current) return;
    const x = e.nativeEvent?.locationX;
    if (typeof x !== 'number') return;
    const fraction = Math.min(1, Math.max(0, x / trackWidth.current));
    seek(fraction * displayDuration);
  }

  function skipBack() {
    if (!isCurrent) return;
    seek(Math.max(0, position - 15000));
  }

  // A resting card: just the invitation to listen, no meters.
  if (!hero && !isCurrent) {
    return (
      <View style={[styles.container, style]}>
        <TouchableOpacity
          onPress={handlePlayPause}
          style={styles.playButton}
          activeOpacity={0.7}
          accessibilityLabel="Play"
        >
          <Ionicons name="play" size={20} color={colors.white} style={styles.playIcon} />
        </TouchableOpacity>
        {displayDuration > 0 ? (
          <Text style={styles.restDuration}>{formatTime(displayDuration)}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, hero && styles.containerHero, style]}>
      {hero && isCurrent ? (
        <TouchableOpacity
          onPress={skipBack}
          style={styles.skipButton}
          activeOpacity={0.7}
          accessibilityLabel="Back 15 seconds"
        >
          <Ionicons name="play-back" size={16} color={colors.inkSoft} />
          <Text style={styles.skipLabel}>15</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={handlePlayPause}
        style={[styles.playButton, hero && styles.playButtonHero]}
        activeOpacity={0.7}
        accessibilityLabel={playing ? 'Pause' : 'Play'}
      >
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={hero ? 28 : 20}
          color={colors.white}
          style={playing ? null : styles.playIcon}
        />
      </TouchableOpacity>

      <View style={styles.trackArea}>
        <Pressable
          onPress={handleSeek}
          onLayout={(e) => {
            trackWidth.current = e.nativeEvent.layout.width;
          }}
          disabled={!isCurrent}
          accessibilityLabel="Seek"
          // A generous touch target around the visible track.
          style={styles.trackPress}
        >
          <View style={[styles.progressBackground, hero && styles.progressBackgroundHero]}>
            <View
              style={[
                styles.progressFill,
                hero && styles.progressFillHero,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(displayPosition)}</Text>
          <Text style={styles.timeText}>{formatTime(displayDuration)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  containerHero: {
    paddingVertical: space.md,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
    ...elevation.rest,
  },
  playButtonHero: {
    width: 56,
    height: 56,
    ...elevation.raised,
  },
  // Optically center the triangle.
  playIcon: {
    marginLeft: 2,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunk,
  },
  skipLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.inkSoft,
    marginLeft: 2,
  },
  restDuration: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  trackArea: {
    flex: 1,
  },
  trackPress: {
    paddingVertical: 6,
    justifyContent: 'center',
  },
  progressBackground: {
    height: 6,
    backgroundColor: colors.hairline,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBackgroundHero: {
    height: 8,
    borderRadius: 4,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.ember,
    borderRadius: 3,
  },
  progressFillHero: {
    height: 8,
    borderRadius: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
});
