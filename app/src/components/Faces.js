import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { friendTint, initialOf } from '../utils/people';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

// The faces around a cast — a small overlapping stack of glowing initials.
// Shows up to `max`, then a quiet "+n". Pass `people` ([{ id, name }]) and
// `onPressPerson` to make each face open that person's page.
export default function Faces({
  names = [],
  people,
  onPressPerson,
  size = 24,
  max = 4,
  ringColor = colors.surface,
  style,
}) {
  const list = people || names.map((name) => ({ name }));
  const seen = new Set();
  const unique = list.filter((p) => p.name && !seen.has(p.name) && seen.add(p.name));
  if (unique.length === 0) return null;
  const shown = unique.slice(0, max);
  const extra = unique.length - shown.length;
  return (
    <View
      style={[styles.row, { paddingLeft: size * 0.25 }, style]}
      accessibilityLabel={
        onPressPerson ? undefined : `With ${unique.map((p) => p.name).join(', ')}`
      }
    >
      {shown.map((p) => (
        <Pressable
          key={p.id || p.name}
          disabled={!onPressPerson || !p.id}
          onPress={() => onPressPerson?.(p.id)}
          accessibilityLabel={onPressPerson && p.id ? `Open ${p.name}` : undefined}
          style={[
            styles.face,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size * 0.25,
              borderColor: ringColor,
              backgroundColor: friendTint(p.name),
            },
          ]}
        >
          <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]}>
            {initialOf(p.name)}
          </Text>
        </Pressable>
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
