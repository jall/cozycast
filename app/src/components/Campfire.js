import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Platform, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Ellipse } from 'react-native-svg';
import Glow from './Glow';
import useReducedMotion from '../hooks/useReducedMotion';

// The brand's one light source: a little campfire whose flames flicker from
// their base, whose glow breathes, and which throws the odd spark. Drawn in a
// 200×170 box; every layer is its own SVG so each can be animated as a plain
// view (scale from the flame's base) — cheap on native and on web alike.
// Holds perfectly still under "reduce motion".

const VB_W = 200;
const VB_H = 170;
const native = Platform.OS !== 'web';

const OUTER =
  'M100 30 C120 66 142 86 132 118 C126 136 113 144 100 144 C87 144 74 136 68 118 C60 92 84 70 100 30 Z';
const MIDDLE =
  'M101 62 C115 86 126 100 120 122 C116 134 109 140 100 140 C91 140 84 134 81 122 C76 104 90 88 101 62 Z';
const INNER =
  'M100 94 C108 108 113 116 109 128 C107 134 104 137 100 137 C96 137 93 134 91 128 C88 118 94 108 100 94 Z';

// Sparks: [x within the 200 box, start y, radius, colour, duration, delay, drift]
const SPARKS = [
  [96, 74, 2.4, '#FFB547', 3200, 0, 14],
  [106, 82, 1.8, '#FFD9A0', 2600, 800, -16],
  [88, 88, 1.6, '#FF7A3D', 3000, 1600, 10],
  [112, 70, 2, '#FFB547', 2800, 2200, -12],
  [100, 92, 1.4, '#FFD9A0', 3400, 2900, 6],
];

function useOscillator(halfPeriod, still, delay = 0) {
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (still) {
      v.setValue(0.5);
      return undefined;
    }
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: halfPeriod,
          easing: ease,
          useNativeDriver: native,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: halfPeriod,
          easing: ease,
          useNativeDriver: native,
        }),
      ]),
    );
    const t = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [v, halfPeriod, still, delay]);
  return v;
}

function Spark({ spec, scale, still }) {
  const [x, y, r, color, duration, delay, drift] = spec;
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return undefined;
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: native }),
    );
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [t, duration, delay, still]);
  if (still) return null;
  const d = r * 2 * scale;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x * scale - d / 2,
        top: y * scale - d / 2,
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: color,
        opacity: t.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 0.5, 0] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -70 * scale] }) },
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, drift * scale] }) },
        ],
      }}
    />
  );
}

function Layer({ d, fill, width, height, osc, amount }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          transformOrigin: '50% 85%',
          transform: [
            {
              scaleX: osc.interpolate({
                inputRange: [0, 1],
                outputRange: [1 + amount * 0.4, 1 - amount * 0.4],
              }),
            },
            {
              scaleY: osc.interpolate({
                inputRange: [0, 1],
                outputRange: [1 - amount, 1 + amount],
              }),
            },
          ],
        },
      ]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Path d={d} fill={fill} />
      </Svg>
    </Animated.View>
  );
}

export default function Campfire({
  width = 200,
  sparks = true,
  glow = true,
  still = false,
  style,
}) {
  const reduced = useReducedMotion();
  const calm = still || reduced;
  const height = Math.round((width * VB_H) / VB_W);
  const scale = width / VB_W;

  const outer = useOscillator(850, calm);
  const middle = useOscillator(560, calm, 120);
  const inner = useOscillator(430, calm, 260);
  const breath = useOscillator(1200, calm);

  return (
    <View
      style={[{ width, height }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {glow ? (
        <Animated.View
          style={[
            styles.glow,
            {
              left: -width * 0.35,
              right: -width * 0.35,
              top: height * 0.35,
              bottom: -height * 0.25,
              opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] }),
            },
          ]}
        >
          <Glow color="#FF7A3D" strength={0.55} />
        </Animated.View>
      ) : null}

      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={StyleSheet.absoluteFill}
      >
        <Ellipse cx="100" cy="150" rx="78" ry="13" fill="#FF7A3D" opacity={0.3} />
      </Svg>

      {sparks ? SPARKS.map((s, i) => <Spark key={i} spec={s} scale={scale} still={calm} />) : null}

      <Layer d={OUTER} fill="#FF6A2E" width={width} height={height} osc={outer} amount={0.06} />
      <Layer d={MIDDLE} fill="#FFA23D" width={width} height={height} osc={middle} amount={0.07} />
      <Layer d={INNER} fill="#FFE2A6" width={width} height={height} osc={inner} amount={0.08} />

      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={StyleSheet.absoluteFill}
      >
        <Rect
          x="52"
          y="138"
          width="96"
          height="14"
          rx="7"
          fill="#5B3A2C"
          transform="rotate(-10 100 145)"
        />
        <Rect
          x="52"
          y="138"
          width="96"
          height="14"
          rx="7"
          fill="#6E4633"
          transform="rotate(10 100 145)"
        />
        <Circle cx="57" cy="148" r="4" fill="#3E2820" />
        <Circle cx="143" cy="148" r="4" fill="#3E2820" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
  },
});
