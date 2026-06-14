import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

function formatTime(millis) {
  if (!millis || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ uri, style }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const soundRef = useRef(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  async function loadSound() {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true },
      onPlaybackStatusUpdate,
    );
    soundRef.current = newSound;
    setIsLoaded(true);
    setIsPlaying(true);
  }

  function onPlaybackStatusUpdate(status) {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  }

  async function handlePlayPause() {
    if (!isLoaded) {
      await loadSound();
      return;
    }

    if (isPlaying) {
      await soundRef.current?.pauseAsync();
    } else {
      // If finished, replay from start
      if (position >= duration && duration > 0) {
        await soundRef.current?.setPositionAsync(0);
      }
      await soundRef.current?.playAsync();
    }
  }

  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity onPress={handlePlayPause} style={styles.playButton} activeOpacity={0.7}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.trackArea}>
        <View style={styles.progressBackground}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
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
