import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Path, Ellipse } from 'react-native-svg';
import { coverFor, COVER_FLAME, COVER_FLAME_CORE } from '../utils/castCover';

// Auto-generated cover art: a small night scene derived from the cast's id —
// sky, moon, two ridgelines and a little fire — so every cast has its own
// evening with no image generation. The geometry lives in utils/castCover so
// the OS media-session artwork (utils/castArtwork) draws the very same scene.
// (AI-generated covers can replace this later behind an Edge Function, #6.)
export default function CastCover({ seed, title, size = 64, radius, style }) {
  const c = coverFor(seed, title);
  const r = radius ?? Math.round(size * 0.2);

  return (
    <View
      style={[styles.cover, { width: size, height: size, borderRadius: r }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect width="100" height="100" fill={c.sky} />
        {c.stars.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={i === 1 ? 1.1 : 0.8} fill="#F5EADB" opacity={0.7} />
        ))}
        <Circle cx={c.moonX} cy={c.moonY} r="13" fill={c.moon} />
        <Path d={c.far} fill={c.hill1} />
        <Path d={c.near} fill={c.hill2} />
        <Ellipse cx="50" cy="95" rx="11" ry="2.4" fill="#FF7A3D" opacity={0.5} />
        <Path d={COVER_FLAME} fill="#FF8A3D" />
        <Path d={COVER_FLAME_CORE} fill="#FFE2A6" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    overflow: 'hidden',
  },
});
