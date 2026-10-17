import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { friendTint, initialOf } from '../utils/people';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

// The faces around a cast — a small overlapping stack of glowing initials.
// Shows up to `max`, then a quiet "+n".
export default function Faces({
  names = [],
  size = 24,
  max = 4,
  ringColor = colors.surface,
  style,
}) {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length === 0) return null;
  const shown = unique.slice(0, max);
  const extra = unique.length - shown.length;
  return (
    <View
      style={[styles.row, { paddingLeft: size * 0.25 }, style]}
      accessibilityLabel={`With ${unique.join(', ')}`}
    >
      {shown.map((n) => (
        <View
          key={n}
          style={[
            styles.face,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size * 0.25,
              borderColor: ringColor,
              backgroundColor: friendTint(n),
            },
          ]}
        >
          <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]}>
            {initialOf(n)}
          </Text>
        </View>
      ))}
      {extra > 0 ? <Text style={styles.extra}>+{extra}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  face: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: fonts.display,
    color: colors.onEmber,
  },
  extra: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.inkMuted,
    marginLeft: 4,
  },
});
