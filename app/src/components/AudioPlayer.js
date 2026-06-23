import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';

function formatTime(millis) {
  if (!millis || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// The play control on a CastCard. It no longer owns any audio — it reflects and
// drives the app-wide player (see PlayerContext), so only one cast plays at a
// time and playback survives scrolling/tab switches via the MiniPlayer.
export default function AudioPlayer({ uri, style, castId, title, seed, artist, durationSeconds }) {
  const { track, isPlaying, position, duration, toggle } = usePlayer();

  const id = castId ?? uri;
  const isCurrent = track?.id === id;
  const playing = isCurrent && isPlaying;

  // Show this cast's live position when it's the one playing; otherwise fall
  // back to the stored duration so the time still reads before you hit play.
  const displayPosition = isCurrent ? position : 0;
  const displayDuration =
    isCurrent && duration ? duration : durationSeconds ? durationSeconds * 1000 : 0;
  const progress = displayDuration > 0 ? displayPosition / displayDuration : 0;

  function handlePlayPause() {
    toggle({ id, uri, title, seed, artist, durationSeconds });
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity onPress={handlePlayPause} style={styles.playButton} activeOpacity={0.7}>
        <Ionicons name={playing ? 'pause' : 'play'} size={20} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.trackArea}>
        <View style={styles.progressBackground}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
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
    paddingVertical: 8,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8734A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#E8734A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  trackArea: {
    flex: 1,
  },
  progressBackground: {
    height: 6,
    backgroundColor: '#F0E6DA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#E8734A',
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#8C7B6B',
    fontVariant: ['tabular-nums'],
  },
});
