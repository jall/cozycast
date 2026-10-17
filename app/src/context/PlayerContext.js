import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { castArtworkDataUrl } from '../utils/castArtwork';
import { getAudioUrl } from '../api/client';

// One audio session for the whole app. Playback used to live inside each
// CastCard's player, so it died the moment you scrolled away or switched
// tabs. Lifting it here lets a single track keep playing while you browse, and
// gives the persistent MiniPlayer something to drive.
//
// A "track" is { id, uri, audioPath, title, artist, seed, durationSeconds,
// peaks } — id is the cast id, used to tell which card is the one currently
// playing.
// `uri` may be absent: signed URLs are minted lazily on first play (from
// `audioPath`) so a feed of thirty casts doesn't fire thirty storage calls
// just to render play buttons.
const PlayerContext = createContext(null);

// Playback speeds the speed button cycles through.
export const RATES = [1, 1.25, 1.5, 2, 0.75];

// Where you left off in each cast, kept on this device so a card can show its
// banked progress and playback resumes from there. { [castId]: { pos, dur,
// done } } in milliseconds.
const PROGRESS_KEY = 'cozycast.progress.v1';
const SAVE_EVERY_MS = 5000;

export function PlayerProvider({ children }) {
  const [track, setTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  // True from pressing play on a new track until its audio is ready: the UI
  // shows the track (and accepts scrubs) straight away rather than waiting.
  const [loading, setLoading] = useState(false);
  const durationRef = useRef(0);
  const pendingStartRef = useRef(null);
  const loadSeqRef = useRef(0);
  const [progress, setProgress] = useState({});
  const soundRef = useRef(null);
  const rateRef = useRef(1);
  const trackIdRef = useRef(null);
  const progressRef = useRef({});
  const lastSavedRef = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(PROGRESS_KEY)
      .then((raw) => {
        const saved = raw ? JSON.parse(raw) : {};
        progressRef.current = { ...saved, ...progressRef.current };
        setProgress(progressRef.current);
      })
      .catch(() => {});
  }, []);

  const remember = useCallback((id, entry) => {
    if (!id) return;
    progressRef.current = { ...progressRef.current, [id]: entry };
    setProgress(progressRef.current);
    AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progressRef.current)).catch(() => {});
  }, []);

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
    // Lock-screen / headphone skip buttons: back 15s, forward 30s, like the app.
    const nudge = (delta) => async () => {
      const st = await soundRef.current?.getStatusAsync();
      if (!st?.isLoaded) return;
      const max = st.durationMillis || Infinity;
      await soundRef.current.setPositionAsync(
        Math.min(max, Math.max(0, st.positionMillis + delta)),
      );
    };
    try {
      navigator.mediaSession.setActionHandler('seekbackward', nudge(-15000));
      navigator.mediaSession.setActionHandler('seekforward', nudge(30000));
    } catch {
      // Older browsers reject actions they don't know; play/pause still work.
    }
  }

  function setMediaPlaybackState(state) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  const onStatus = useCallback(
    (status) => {
      if (!status.isLoaded) return;
      const pos = status.positionMillis || 0;
      // Browser recordings (WebM) report an Infinity duration until fully
      // read; keep the length we already know (from the cast) until a real one.
      const raw = status.durationMillis;
      if (Number.isFinite(raw) && raw > 0) {
        durationRef.current = raw;
        setDuration(raw);
      }
      const dur = durationRef.current;
      setPosition(pos);
      setIsPlaying(status.isPlaying);
      setMediaPlaybackState(status.isPlaying ? 'playing' : 'paused');
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        setMediaPlaybackState('paused');
        remember(trackIdRef.current, { pos: dur, dur, done: true });
        lastSavedRef.current = 0;
      } else if (dur && Math.abs(pos - lastSavedRef.current) >= SAVE_EVERY_MS) {
        lastSavedRef.current = pos;
        const prev = progressRef.current[trackIdRef.current];
        remember(trackIdRef.current, { pos, dur, done: !!prev?.done });
      }
    },
    [remember],
  );

  // Load a brand-new track and start it (optionally part-way in, e.g. when
  // someone scrubs a cast that isn't playing yet, or taps a note's timestamp).
  // Unloads whatever was playing first.
  const play = useCallback(
    async (next, { startMillis } = {}) => {
      // Resume where you left off unless told otherwise (or it's finished).
      if (startMillis == null) {
        const saved = progressRef.current[next.id];
        startMillis = saved && !saved.done && saved.pos < saved.dur - 3000 ? saved.pos : 0;
      }
      const seq = (loadSeqRef.current += 1);
      if (soundRef.current) {
        const old = soundRef.current;
        soundRef.current = null;
        await old.unloadAsync().catch(() => {});
      }

      // Show the track right away — the panel, card and scrubber respond while
      // the signed URL is minted and the audio loads.
      const known = next.durationSeconds ? next.durationSeconds * 1000 : 0;
      setTrack(next);
      trackIdRef.current = next.id;
      lastSavedRef.current = startMillis;
      pendingStartRef.current = null;
      durationRef.current = known;
      setPosition(startMillis);
      setDuration(known);
      setIsPlaying(false);
      setLoading(true);

      // Mint the signed URL on demand if the caller only had a storage path.
      if (!next.uri && next.audioPath) {
        try {
          next = { ...next, uri: await getAudioUrl(next.audioPath) };
        } catch {
          next = { ...next, uri: null };
        }
      }
      if (seq !== loadSeqRef.current) return; // superseded by another play
      if (!next.uri) {
        setLoading(false);
        setTrack(null);
        return;
      }
      setTrack(next);

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
          {
            shouldPlay: true,
            positionMillis: startMillis,
            rate: rateRef.current,
            shouldCorrectPitch: true,
          },
          onStatus,
        );
        if (seq !== loadSeqRef.current) {
          await sound.unloadAsync().catch(() => {});
          return;
        }
        soundRef.current = sound;
        setLoading(false);
        setIsPlaying(true);
        setupMediaSession(next);
        // Someone scrubbed while it was loading: honour where they let go.
        if (pendingStartRef.current != null) {
          await sound.setPositionAsync(pendingStartRef.current).catch(() => {});
          pendingStartRef.current = null;
        }
      } catch {
        // Bad/expired URL — leave the player idle rather than crashing.
        if (seq !== loadSeqRef.current) return;
        setLoading(false);
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
      if (track && next?.id === track.id && loading) return; // already on its way
      const isCurrent = track && next?.id === track.id && soundRef.current;
      if (!isCurrent) {
        await play(next);
        return;
      }
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        if (duration > 0) remember(track.id, { pos: position, dur: duration, done: false });
      } else {
        if (position >= duration && duration > 0) await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
    },
    [track, isPlaying, position, duration, play, remember, loading],
  );

  const seek = useCallback(async (millis) => {
    const to = Math.max(0, millis);
    setPosition(to); // reflect the scrub immediately; status catches up
    if (soundRef.current) await soundRef.current.setPositionAsync(to);
    else pendingStartRef.current = to; // still loading: applied once it's ready
  }, []);

  // Jump back/forward by `deltaMillis` within the current track.
  const skip = useCallback(
    async (deltaMillis) => {
      if (!soundRef.current) return;
      const max = duration > 0 ? duration : Infinity;
      await seek(Math.min(max, Math.max(0, position + deltaMillis)));
    },
    [position, duration, seek],
  );

  // Step to the next playback speed (pitch-corrected). Sticks across tracks.
  const cycleRate = useCallback(async () => {
    const next = RATES[(RATES.indexOf(rateRef.current) + 1) % RATES.length];
    rateRef.current = next;
    setRateState(next);
    await soundRef.current?.setRateAsync(next, true).catch(() => {});
  }, []);

  // Dismiss the player entirely (the mini-player's close button).
  const stop = useCallback(async () => {
    loadSeqRef.current += 1;
    setLoading(false);
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setTrack(null);
    trackIdRef.current = null;
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }, []);

  const value = {
    track,
    isPlaying,
    position,
    duration,
    rate,
    toggle,
    play,
    seek,
    skip,
    cycleRate,
    stop,
    progress,
    loading,
  };
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider');
  return ctx;
}
