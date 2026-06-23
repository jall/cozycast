import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CastCover from './CastCover';
import { usePlayer } from '../context/PlayerContext';
import { fonts } from '../theme/typography';

// A persistent now-playing strip that sits just above the tab bar. It shows
// whatever the app-wide player (PlayerContext) is playing, so audio keeps going
// — with controls — as you move between Feed, Record, and Profile. Hidden when
// nothing is loaded.
export default function MiniPlayer() {
  const { track, isPlaying, position, duration, toggle, stop } = usePlayer();

  if (!track) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <CastCover seed={track.seed} title={track.title} size={40} />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {track.title}
          </Text>
          {track.artist ? (
            <Text style={styles.artist} numberOfLines={1}>
              {track.artist}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => toggle(track)}
          style={styles.playButton}
          activeOpacity={0.7}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={stop}
          style={styles.closeButton}
          activeOpacity={0.7}
          accessibilityLabel="Close player"
        >
          <Ionicons name="close" size={20} color="#A89888" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0E6DA',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#F0E6DA',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#E8734A',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  meta: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
  },
  artist: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#A89888',
    marginTop: 1,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8734A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});
