import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// True when the person has asked their OS for less motion. Every ambient loop
// in the Campfire look (flames, sparks, twinkling stars, the breathing glow)
// checks this and holds still instead.
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => active && setReduced(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(!!v));
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}
