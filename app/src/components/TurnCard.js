import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import Waveform from './Waveform';
import { makersOf } from '../utils/turns';
import { trackFor } from '../utils/track';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius } from '../theme/space';

// Someone passed you the mic on a cast you're making in turns: what they
// asked, the shape so far, and the way to answer.
export default function TurnCard({ cast, onTakeTurn, onOpen, style }) {
  const last = cast.turns?.[cast.turns.length - 1];
  const from = makersOf(cast).find((m) => m.id === last?.author_id) || {
    name: cast.creator_name,
  };
  const track = trackFor(cast);
  return (
    <View style={[styles.card, style]} testID="turn-card">
      <TouchableOpacity
        style={styles.head}
        onPress={onOpen}
        accessibilityLabel={`Open ${cast.title}`}
      >
        <Avatar name={from.name} size={22} />
        <Text style={styles.from}>{from.name} passed you the mic</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{cast.title}</Text>
      {last?.question ? <Text style={styles.question}>“{last.question}”</Text> : null}
      <Waveform
        seed={cast.id}
        peaks={track.peaks}
        bands={track.bands?.length > 1 ? track.bands : undefined}
        bars={72}
        height={26}
        style={styles.wave}
      />
      <View style={styles.actions}>
        <TouchableOpacity onPress={onOpen} style={styles.later}>
          <Text style={styles.laterText}>Hear it first</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onTakeTurn} style={styles.go} testID="turn-take">
          <Ionicons name="mic" size={16} color={colors.onEmber} />
          <Text style={styles.goText}>Record your turn</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: space.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  from: {
    ...type.eyebrow,
    color: colors.emberInk,
    marginLeft: space.sm,
  },
  title: {
    ...type.h2,
    color: colors.ink,
    marginTop: space.md,
  },
  question: {
    fontFamily: type.moment.fontFamily,
    fontSize: 19,
    lineHeight: 26,
    color: colors.inkSoft,
    marginTop: space.sm,
  },
  wave: {
    marginTop: space.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: space.md,
  },
  later: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  laterText: {
    ...type.label,
    color: colors.inkMuted,
  },
  go: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    marginLeft: space.sm,
  },
  goText: {
    ...type.h3,
    fontSize: 14,
    color: colors.onEmber,
    marginLeft: 6,
  },
});
