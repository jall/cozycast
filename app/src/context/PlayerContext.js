import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { castArtworkDataUrl } from '../utils/castArtwork';

// One audio session for the whole app. Playback used to live inside each
// CastCard's AudioPlayer, so it died the moment you scrolled away or switched
// tabs. Lifting it here lets a single track keep playing while you browse, and
// gives the persistent MiniPlayer something to drive.
//
// A "track" is { id, uri, title, artist, seed, durationSeconds } — id is the
// cast id, used to tell which card is the one currently playing.
const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [track, setTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  // Tell the OS media session (lock screen / control center) what's playing and
  // give it a high-res cover instead of the default favicon. Web only.
  function setupMediaSession(t) {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('mediaSession' in navigator))
      return;
    const artwork = castArtworkDataUrl(t.seed, t.title);
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: t.title || 'cozycast',
      artist: t.artist || 'cozycast',
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

  const onStatus = useCallback((status) => {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis || 0);
    if (status.durationMillis) setDuration(status.durationMillis);
    setIsPlaying(status.isPlaying);
    setMediaPlaybackState(status.isPlaying ? 'playing' : 'paused');
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
      setMediaPlaybackState('paused');
    }
  }, []);

  // Load a brand-new track and start it. Unloads whatever was playing first.
  const play = useCallback(
    async (next) => {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setTrack(next);
      setPosition(0);
      setDuration(next.durationSeconds ? next.durationSeconds * 1000 : 0);
      setIsPlaying(false);

      // Native: keep audio going when the screen locks / app backgrounds (web
      // gets the same via the browser). Guarded so a missing background-mode
      // config can't crash playback.
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
        }).catch(() => {});
      }

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: next.uri },
          { shouldPlay: true },
          onStatus,
        );
        soundRef.current = sound;
        setIsPlaying(true);
        setupMediaSession(next);
      } catch {
        // Bad/expired URL — leave the player idle rather than crashing.
        setTrack(null);
        setIsPlaying(false);
      }
    },
    [onStatus],
  );

  // The card / mini-player play button: resume or pause the current track, or
  // switch to a different one. `next` is a full track object.
  const toggle = useCallback(
    async (next) => {
      const isCurrent = track && next?.id === track.id && soundRef.current;
      if (!isCurrent) {
        await play(next);
        return;
      }
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        if (position >= duration && duration > 0) await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
    },
    [track, isPlaying, position, duration, play],
  );

  const seek = useCallback(async (millis) => {
    await soundRef.current?.setPositionAsync(Math.max(0, millis));
  }, []);

  // Dismiss the player entirely (the mini-player's close button).
  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setTrack(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }, []);

  const value = { track, isPlaying, position, duration, toggle, play, seek, stop };
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider');
  return ctx;
}
