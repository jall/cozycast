import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius } from '../theme/space';

// Someone asked you for a cast: their prompt, and the way to answer it.
export default function AskCard({ request, onAnswer, onDismiss, onOpenPerson, style }) {
  return (
    <View style={[styles.card, style]} testID="ask-card">
      <View style={styles.head}>
        <TouchableOpacity
          style={styles.who}
          onPress={() => onOpenPerson?.(request.from.id)}
          accessibilityLabel={`Open ${request.from.name}`}
        >
          <Avatar name={request.from.name} size={22} />
          <Text style={styles.from}>{request.from.name} asked you for a cast</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.prompt}>“{request.prompt}”</Text>
      <View style={styles.actions}>
        {onDismiss ? (
          <TouchableOpacity onPress={onDismiss} style={styles.later}>
            <Text style={styles.laterText}>Not now</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={onAnswer} style={styles.answer} testID="ask-answer">
          <Ionicons name="mic" size={16} color={colors.onEmber} />
          <Text style={styles.answerText}>Answer with a cast</Text>
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
  who: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  from: {
    ...type.eyebrow,
    color: colors.emberInk,
    marginLeft: space.sm,
  },
  prompt: {
    fontFamily: type.moment.fontFamily,
    fontSize: 21,
    lineHeight: 28,
    color: colors.ink,
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
  answer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    marginLeft: space.sm,
  },
  answerText: {
    ...type.h3,
    fontSize: 14,
    color: colors.onEmber,
    marginLeft: 6,
  },
});
