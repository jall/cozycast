import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { castArtworkDataUrl } from '../utils/castArtwork';

function formatTime(millis) {
  if (!millis || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ uri, style, title, seed, artist, durationSeconds }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  // Seed the total time from the stored duration so it shows before playback
  // (otherwise the player reads 0:00 until you press play). Real metadata, once
  // the sound loads, overwrites this.
  const [duration, setDuration] = useState(durationSeconds ? durationSeconds * 1000 : 0);
  const [isLoaded, setIsLoaded] = useState(false);
  const soundRef = useRef(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Tell the OS media session (lock screen / control center) what's playing and
  // give it a high-res cover, instead of the default favicon. Web only.
  function setupMediaSession() {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('mediaSession' in navigator))
      return;
    const artwork = castArtworkDataUrl(seed, title);
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: title || 'cozycast',
      artist: artist || 'cozycast',
      album: 'cozycast',
      artwork: artwork ? [{ src: artwork, sizes: '512x512', type: 'image/png' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', () => soundRef.current?.playAsync());
    navigator.mediaSession.setActionHandler('pause', () => soundRef.current?.pauseAsync());
  }

  function setMediaPlaybackState(state) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  async function loadSound() {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
    // Native: keep audio going when the screen locks / app backgrounds (web gets
    // the same via the browser). Guarded so a missing background-mode config
    // can't crash playback.
    if (Platform.OS !== 'web') {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    }
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true },
      onPlaybackStatusUpdate,
    );
    soundRef.current = newSound;
    setIsLoaded(true);
    setIsPlaying(true);
    setupMediaSession();
  }

  function onPlaybackStatusUpdate(status) {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      if (status.durationMillis) setDuration(status.durationMillis);
      setIsPlaying(status.isPlaying);
      setMediaPlaybackState(status.isPlaying ? 'playing' : 'paused');
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        setMediaPlaybackState('paused');
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
