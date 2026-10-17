import { useEffect, useRef, useState } from 'react';
import { Animated, Platform } from 'react-native';

const HISTORY = 48;

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS reports itself as a Mac; touch gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// How loud you are right now, while `active`: a smoothed 0–1 `level`
// (Animated, for driving the fire every frame) and a short rolling `history`
// (for the live waveform, ~11 updates a second). Web listens to the mic through
// Web Audio alongside the recorder. Not on iOS: Safari can mute the recorder's
// track when a second mic stream opens, and a broken recording is far worse than
// a static fire — there (and on native, which has no metering here) the level
// just breathes gently on its own.
export default function useMicLevel(active) {
  const level = useRef(new Animated.Value(0.35)).current;
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!active) {
      setHistory([]);
      return undefined;
    }
    const mic = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
    if (Platform.OS !== 'web' || !mic?.getUserMedia || isIOS()) {
      const breathe = Animated.loop(
        Animated.sequence([
          Animated.timing(level, { toValue: 0.6, duration: 1400, useNativeDriver: false }),
          Animated.timing(level, { toValue: 0.3, duration: 1400, useNativeDriver: false }),
        ]),
      );
      breathe.start();
      return () => breathe.stop();
    }

    let live = true;
    let stream;
    let ctx;
    let raf;
    let smooth = 0;
    let last = 0;
    const hist = [];

    mic
      .getUserMedia({ audio: true })
      .then((s) => {
        if (!live) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        ctx = new Ctx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(s).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const tick = (t) => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          // sqrt keeps quiet talk visible; ~0.2 RMS (talking up close) ≈ full.
          const v = Math.min(1, Math.sqrt(Math.sqrt(sum / buf.length)) * 2.2);
          smooth = smooth * 0.8 + v * 0.2;
          level.setValue(smooth);
          if (t - last > 90) {
            last = t;
            hist.push(smooth);
            if (hist.length > HISTORY) hist.shift();
            setHistory([...hist]);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {});

    return () => {
      live = false;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close?.().catch(() => {});
    };
  }, [active, level]);

  return { level, history, slots: HISTORY };
}
