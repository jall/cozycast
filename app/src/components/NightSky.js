import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, Easing, Platform, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import useReducedMotion from '../hooks/useReducedMotion';
import { hash } from '../utils/castCover';
import { colors } from '../theme/colors';

const native = Platform.OS !== 'web';

// A slice of night sky (fixed `height`, or sized by its children): scattered stars that twinkle in three slow phases, and
// two soft ridgelines along the bottom that melt into `groundColor` (the
// surface it sits on). Children render on top — the feed greeting and the
// campfire live here.
export default function NightSky({
  height,
  starCount = 26,
  seed = 'cozycast',
  groundColor = colors.bg,
  radius = 0,
  style,
  children,
}) {
  const reduced = useReducedMotion();
  const phases = [
    useRef(new Animated.Value(0.6)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.9)).current,
  ];

  useEffect(() => {
    if (reduced) return undefined;
    const loops = phases.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: 1400 + i * 500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: native,
          }),
          Animated.timing(v, {
            toValue: 0.2,
            duration: 1400 + i * 500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: native,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const stars = useMemo(() => {
    let s = hash(seed) || 7;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    return Array.from({ length: starCount }, () => ({
      left: `${(rand() * 100).toFixed(1)}%`,
      top: `${(4 + rand() * 58).toFixed(1)}%`,
      size: rand() > 0.82 ? 2.5 : 1.5,
      phase: Math.floor(rand() * 3),
    }));
  }, [seed, starCount]);

  return (
    <View style={[styles.sky, height != null && { height }, { borderRadius: radius }, style]}>
      {stars.map((st, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.star,
            {
              left: st.left,
              top: st.top,
              width: st.size,
              height: st.size,
              borderRadius: st.size,
              opacity: phases[st.phase],
            },
          ]}
        />
      ))}
      <View style={styles.hills} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 800 70" preserveAspectRatio="none">
          <Path d="M0 40 Q120 10 240 34 T480 30 T800 22 V70 H0Z" fill="#231B2E" />
          <Path d="M0 58 Q160 40 320 54 T640 50 T800 46 V70 H0Z" fill={groundColor} />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sky: {
    backgroundColor: '#1A1526',
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
    backgroundColor: colors.ink,
  },
  hills: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
  },
});
