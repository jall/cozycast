import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coverFor } from '../utils/castCover';

// Auto-generated cover art: a warm, handmade-feeling look derived from the
// cast's id, so every cast gets its own cozy identity with no image generation.
// Layered translucent blobs (light accent + deep shade) over a base colour give
// a soft gradient-ish depth; a crisp line glyph sits on top. The palette/blob
// logic lives in utils/castCover so the OS media-session artwork can reuse it.
// (AI-generated covers can replace this later behind an Edge Function, #6.)

export default function CastCover({ seed, title, size = 64, style }) {
  const { base, accent, deep, icon, blobs } = coverFor(seed, title);

  const radius = Math.round(size * 0.22);
  const big = Math.round(size * 1.05);
  const small = Math.round(size * 0.8);

  return (
    <View
      style={[
        styles.cover,
        { width: size, height: size, borderRadius: radius, backgroundColor: base },
        style,
      ]}
    >
      {/* Soft light accent blob. */}
      <View
        style={[
          styles.blob,
          {
            width: big,
            height: big,
            borderRadius: big / 2,
            backgroundColor: accent,
            opacity: 0.55,
            left: size * blobs.accentX - big / 2,
            top: size * blobs.accentY - big / 2,
          },
        ]}
      />
      {/* Deeper shade blob for depth. */}
      <View
        style={[
          styles.blob,
          {
            width: small,
            height: small,
            borderRadius: small / 2,
            backgroundColor: deep,
            opacity: 0.45,
            left: size * blobs.deepX - small / 2,
            top: size * blobs.deepY - small / 2,
          },
        ]}
      />
      {/* Faint top-left highlight, like light catching a surface. */}
      <View
        style={[
          styles.blob,
          {
            width: small,
            height: small,
            borderRadius: small / 2,
            backgroundColor: '#FFFFFF',
            opacity: 0.12,
            left: -small * 0.3,
            top: -small * 0.3,
          },
        ]}
      />
      <Ionicons name={icon} size={Math.round(size * 0.4)} color="rgba(255,255,255,0.92)" />
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
  },
});
