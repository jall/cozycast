import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Auto-generated cover art: a warm, deterministic look derived from the cast's
// id, so every cast gets its own cozy identity without any image generation.
// (A richer AI-generated cover can replace this later behind an Edge Function.)

// Cozy two-tone palettes (background + soft accent blob).
const PALETTES = [
  ['#E8734A', '#F4A261'],
  ['#C97B5A', '#E8A87C'],
  ['#A8763E', '#E8C06A'],
  ['#7C9A7E', '#B5CDA3'],
  ['#6B8E9E', '#A9C5D1'],
  ['#9B6A8F', '#D2A6C7'],
  ['#B5654A', '#E89B7C'],
  ['#8A8FB0', '#C2C6E0'],
];

const GLYPHS = ['☕', '🌙', '🍂', '✨', '🪴', '🔥', '🫖', '📻', '🕯️', '🌻'];

function hash(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0; // force 32-bit
  }
  return Math.abs(h);
}

export default function CastCover({ seed, title, size = 64, style }) {
  const key = seed || title || 'cozycast';
  const h = hash(key);
  const [base, accent] = PALETTES[h % PALETTES.length];
  const glyph = GLYPHS[(h >> 3) % GLYPHS.length];

  const radius = Math.round(size * 0.22);
  const blob = Math.round(size * 0.9);

  return (
    <View
      style={[
        styles.cover,
        { width: size, height: size, borderRadius: radius, backgroundColor: base },
        style,
      ]}
    >
      <View
        style={[
          styles.blob,
          {
            width: blob,
            height: blob,
            borderRadius: blob / 2,
            backgroundColor: accent,
            top: -blob * 0.3,
            right: -blob * 0.25,
          },
        ]}
      />
      <Text style={[styles.glyph, { fontSize: Math.round(size * 0.42) }]}>{glyph}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    opacity: 0.55,
  },
  glyph: {
    textAlign: 'center',
  },
});
