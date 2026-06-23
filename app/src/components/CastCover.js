import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { coverFor } from '../utils/castCover';

// Auto-generated cover art: a warm, deterministic look derived from the cast's
// id, so every cast gets its own cozy identity without any image generation.
// The palette/glyph logic lives in utils/castCover so the OS media-session
// artwork can reuse it. (AI-generated cover can replace this later.)

export default function CastCover({ seed, title, size = 64, style }) {
  const { base, accent, glyph } = coverFor(seed, title);

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
