import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { avatarUrl } from '../api/client';
import { friendTint as tintFor, initialOf } from '../utils/people';

// A person's profile picture. Pass either a storage `path` (preferred — resolved
// to a public URL) or a ready `uri`. With no image, or if it fails to load, we
// fall back to the person's initial on a deterministic warm tint, so every
// avatar still feels distinct and on-brand.

// The initials fallback uses the person's glow (utils/people): a stable soft
// tint per name, shared with their faces around a cast and their note markers.

export default function Avatar({ name, path, uri, size = 40, style }) {
  const resolved = uri || avatarUrl(path);
  const [failed, setFailed] = useState(false);

  // A changed source (e.g. after the user updates their picture) should retry.
  useEffect(() => setFailed(false), [resolved]);

  const dim = { width: size, height: size, borderRadius: size / 2 };

  if (resolved && !failed) {
    return (
      <Image
        source={{ uri: resolved }}
        style={[styles.base, dim, style]}
        onError={() => setFailed(true)}
        accessibilityLabel={name ? `${name}'s picture` : 'Profile picture'}
      />
    );
  }

  return (
    <View style={[styles.base, styles.fallback, dim, { backgroundColor: tintFor(name) }, style]}>
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]}>{initialOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceSunk,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.onEmber,
    fontFamily: fonts.display,
  },
});
