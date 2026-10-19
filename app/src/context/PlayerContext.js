import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { castArtworkDataUrl } from '../utils/castArtwork';
import { getAudioUrl, markPlayed } from '../api/client';
import { segmentsFor, restack, totalOf, locate } from '../utils/segments';

// One audio session for the whole app. Playback used to live inside each
// CastCard's player, so it died the moment you scrolled away or switched
// tabs. Lifting it here lets a single track keep playing while you browse, and
// gives the persistent MiniPlayer something to drive.
//
// A "track" is { id, uri, audioPath, title, artist, seed, durationSeconds,
// peaks } — id is the cast id, used to tell which card is the one currently
// playing. A cast made in turns also has `segments` ([{ audioPath,
// durationMs }]) — its takes, played back to back as one. A voice note passes
// `onStart` (marking it heard) in place of recording a cast listen.
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
  const positionRef = useRef(0);
  const isPlayingRef = useRef(false);
  const pendingStartRef = useRef(null);
  const loadSeqRef = useRef(0);
  const [progress, setProgress] = useState({});
  const soundRef = useRef(null);
  const rateRef = useRef(1);
  const trackIdRef = useRef(null);
  const progressRef = useRef({});
  const lastSavedRef = useRef(0);
  // The track's segments (utils/segments): one file, or a cast's turns played
  // back to back. Positions the UI sees are across the whole track.
  const segsRef = useRef([]);
  const segIdxRef = useRef(0);
  // Bumped whenever a segment's sound is (un)loaded, so a late status update
  // from an old sound is ignored.
  const soundTokenRef = useRef(0);
  // Played to the very end: pressing play starts it over.
  const finishedRef = useRef(false);
  // The latest internal functions, for callbacks that outlive a render.
  const impl = useRef({});

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

  function setPlaying(v) {
    isPlayingRef.current = v;
    setIsPlaying(v);
  }

  function setPos(v) {
    positionRef.current = v;
    setPosition(v);
  }

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
    const nudge = (delta) => () => {
      const max = durationRef.current || Infinity;
      impl.current.seekTo(Math.min(max, Math.max(0, positionRef.current + delta)));
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

  function onStatus(status, idx, token) {
    if (token !== soundTokenRef.current || !status.isLoaded) return;
    const segs = segsRef.current;
    const seg = segs[idx];
    if (!seg) return;
    // Browser recordings (WebM) report an Infinity duration until fully
    // read; keep the length we already know (from the cast) until a real one.
    const raw = status.durationMillis;
    if (Number.isFinite(raw) && raw > 0 && raw !== seg.durMs) {
      seg.durMs = raw;
      restack(segs);
      durationRef.current = totalOf(segs);
      setDuration(durationRef.current);
    }
    const dur = durationRef.current;
    const pos = seg.startMs + (status.positionMillis || 0);
    setPos(pos);
    if (status.didJustFinish) {
      // On to the next turn.
      if (idx < segs.length - 1) {
        impl.current.loadSegment(idx + 1, 0, true).catch(() => {});
        return;
      }
      finishedRef.current = true;
      setPlaying(false);
      setPos(0);
      setMediaPlaybackState('paused');
      remember(trackIdRef.current, { pos: dur, dur, done: true });
      lastSavedRef.current = 0;
      return;
    }
    setPlaying(status.isPlaying);
    setMediaPlaybackState(status.isPlaying ? 'playing' : 'paused');
    if (dur && Math.abs(pos - lastSavedRef.current) >= SAVE_EVERY_MS) {
      lastSavedRef.current = pos;
      const prev = progressRef.current[trackIdRef.current];
      remember(trackIdRef.current, { pos, dur, done: !!prev?.done });
    }
  }

  // Load one segment of the current track (unloading whatever's loaded) and
  // start it `local` ms in. Resolves false if a newer load superseded it;
  // throws if its audio can't be had.
  async function loadSegment(idx, local, shouldPlay) {
    const seq = loadSeqRef.current;
    const token = (soundTokenRef.current += 1);
    segIdxRef.current = idx;
    if (soundRef.current) {
      const old = soundRef.current;
      soundRef.current = null;
      await old.unloadAsync().catch(() => {});
    }
    const segs = segsRef.current;
    const seg = segs[idx];
    if (!seg) throw new Error('Nothing to play.');
    // Mint the signed URL on demand if we only have a storage path.
    if (!seg.uri && seg.audioPath) {
      setLoading(true);
      seg.uri = await getAudioUrl(seg.audioPath).catch(() => null);
    }
    if (seq !== loadSeqRef.current || token !== soundTokenRef.current) return false;
    if (!seg.uri) throw new Error('That audio isn’t available.');

    const { sound } = await Audio.Sound.createAsync(
      { uri: seg.uri },
      {
        shouldPlay,
        positionMillis: local,
        rate: rateRef.current,
        shouldCorrectPitch: true,
      },
      (st) => onStatus(st, idx, token),
    );
    if (seq !== loadSeqRef.current || token !== soundTokenRef.current) {
      await sound.unloadAsync().catch(() => {});
      return false;
    }
    soundRef.current = sound;
    setLoading(false);
    setPlaying(shouldPlay);
    // Get the next turn's URL ready so the hand-over is seamless.
    const next = segs[idx + 1];
    if (next && !next.uri && next.audioPath) {
      getAudioUrl(next.audioPath)
        .then((uri) => {
          if (!next.uri) next.uri = uri;
        })
        .catch(() => {});
    }
    // Someone scrubbed while it was loading: honour where they let go.
    if (pendingStartRef.current != null) {
      const to = pendingStartRef.current;
      pendingStartRef.current = null;
      await seekTo(to);
    }
    return true;
  }

  // Move to a moment anywhere in the track (loading another turn if need be).
  async function seekTo(millis, { resume = false } = {}) {
    const segs = segsRef.current;
    if (segs.length === 0) return;
    const to = Math.max(0, millis);
    finishedRef.current = false;
    setPos(to); // reflect the scrub immediately; status catches up
    if (!soundRef.current) {
      pendingStartRef.current = to; // still loading: applied once it's ready
      return;
    }
    const { idx, local } = locate(segs, to);
    if (idx === segIdxRef.current) {
      await soundRef.current.setPositionAsync(local).catch(() => {});
      if (resume) await soundRef.current.playAsync().catch(() => {});
      return;
    }
    await loadSegment(idx, local, resume || isPlayingRef.current).catch(() => {});
  }

  impl.current = { loadSegment, seekTo };

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
      soundTokenRef.current += 1;
      if (soundRef.current) {
        const old = soundRef.current;
        soundRef.current = null;
        await old.unloadAsync().catch(() => {});
      }

      // Show the track right away — the panel, card and scrubber respond while
      // the signed URL is minted and the audio loads.
      const segs = segmentsFor(next);
      segsRef.current = segs;
      const known = totalOf(segs);
      setTrack(next);
      trackIdRef.current = next.id;
      lastSavedRef.current = startMillis;
      pendingStartRef.current = null;
      finishedRef.current = false;
      durationRef.current = known;
      setPos(startMillis);
      setDuration(known);
      setPlaying(false);
      setLoading(true);

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
        const { idx, local } = locate(segs, startMillis);
        const ok = await impl.current.loadSegment(idx, local, true);
        if (!ok) return;
        setupMediaSession(next);
        // Pressing play counts as hearing it (clears "New", and lets the people
        // who made/shared it know someone listened). First play only; quiet.
        // A track that isn't a cast (a voice note) says what hearing it means.
        if (next.onStart) next.onStart();
        else markPlayed(next.id).catch(() => {});
      } catch {
        // Bad/expired URL — leave the player idle rather than crashing.
        if (seq !== loadSeqRef.current) return;
        setLoading(false);
        setTrack(null);
        setPlaying(false);
      }
    },
    // setupMediaSession only touches refs and the browser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
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
      } else if (finishedRef.current || (position >= duration && duration > 0)) {
        await impl.current.seekTo(0, { resume: true });
      } else {
        await soundRef.current.playAsync();
      }
    },
    [track, isPlaying, position, duration, play, remember, loading],
  );

  const seek = useCallback((millis) => impl.current.seekTo(millis), []);

  // Hold whatever's playing (e.g. when you start recording).
  const pause = useCallback(async () => {
    if (soundRef.current && isPlayingRef.current) {
      await soundRef.current.pauseAsync().catch(() => {});
    }
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
    soundTokenRef.current += 1;
    setLoading(false);
    if (soundRef.current) {
      const old = soundRef.current;
      soundRef.current = null;
      await old.unloadAsync().catch(() => {});
    }
    segsRef.current = [];
    setTrack(null);
    trackIdRef.current = null;
    setIsPlaying(false);
    isPlayingRef.current = false;
    setPos(0);
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
    pause,
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
