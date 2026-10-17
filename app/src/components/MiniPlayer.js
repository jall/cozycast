import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CastCover from './CastCover';
import SkipIcon from './SkipIcon';
import { usePlayer } from '../context/PlayerContext';
import { formatClock } from '../utils/waveform';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { type } from '../theme/type';
import { layout, space, radius, elevation } from '../theme/space';

// A persistent now-playing strip, docked just above the phone's tab bar (and at
// the bottom of the cast page). It shows whatever the app-wide player
// (PlayerContext) is playing, so audio keeps going — with controls — as you
// move around. Tap it to open the cast and its full player. Hidden when
// nothing is loaded, and on laptops where the now-playing panel does this job.
export default function MiniPlayer({ hideFor }) {
  const { track, isPlaying, position, duration, toggle, skip, stop } = usePlayer();
  const router = useRouter();

  if (!track || track.id === hideFor) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Pressable
            style={styles.body}
            onPress={() => router.push(`/cast/${track.id}`)}
            accessibilityLabel={`Open ${track.title}`}
          >
            <CastCover seed={track.seed} title={track.title} size={44} radius={10} />
            <View style={styles.meta}>
              <Text style={styles.title} numberOfLines={1}>
                {track.title}
              </Text>
              <Text style={styles.time} numberOfLines={1}>
                {formatClock(position)}
                {duration > 0 ? ` / ${formatClock(duration)}` : ''}
                {track.artist ? `  ·  ${track.artist}` : ''}
              </Text>
            </View>
          </Pressable>
          <TouchableOpacity
            onPress={() => skip(-15000)}
            style={styles.iconButton}
            accessibilityLabel="Back 15 seconds"
          >
            <SkipIcon seconds={15} size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggle(track)}
            style={styles.playButton}
            activeOpacity={0.8}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={19}
              color={colors.onEmber}
              style={isPlaying ? null : { marginLeft: 2 }}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={stop}
            style={styles.iconButton}
            activeOpacity={0.7}
            accessibilityLabel="Close player"
          >
            <Ionicons name="close" size={20} color={colors.inkMuted} />
          </TouchableOpacity>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    paddingTop: space.xs,
  },
  card: {
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
    borderRadius: radius.md - 2,
    overflow: 'hidden',
    backgroundColor: '#2A2131',
    borderWidth: 1,
    borderColor: '#3A2E3E',
    ...elevation.raised,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 9,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  meta: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
  },
  time: {
    ...type.time,
    fontSize: 11,
    lineHeight: 15,
    color: colors.inkSoft,
    marginTop: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.smoke,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.ember,
  },
});
