import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { formatClock } from '../utils/waveform';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius } from '../theme/space';

// How many lines show before "Read it all".
const PREVIEW = 6;

// What was said, to read along with: each line with its moment (tap to jump
// there), the line being heard lit up. A cast made in turns passes a part per
// turn ({ key, name, color, offsetMs, segments }) so each starts with who's
// speaking; a plain cast passes one part without a name.
export default function Transcript({ parts, position, onSeek, writing }) {
  const [open, setOpen] = useState(false);
  const lines = [];
  (parts || []).forEach((p) => {
    (p.segments || []).forEach((g, i) => {
      lines.push({
        key: `${p.key}-${i}`,
        at: p.offsetMs + g.s * 1000,
        until: p.offsetMs + g.e * 1000,
        text: g.t,
        who: i === 0 && p.name ? p : null,
      });
    });
  });

  if (lines.length === 0) {
    return writing ? (
      <View style={styles.section}>
        <Text style={styles.heading}>What was said</Text>
        <Text style={styles.quiet}>Writing down what was said…</Text>
      </View>
    ) : null;
  }

  const shown = open ? lines : lines.slice(0, PREVIEW);
  return (
    <View style={styles.section} testID="transcript">
      <Text style={styles.heading}>What was said</Text>
      {shown.map((l) => {
        const now = position != null && position >= l.at && position < l.until;
        return (
          <View key={l.key}>
            {l.who ? <Text style={[styles.who, { color: l.who.color }]}>{l.who.name}</Text> : null}
            <TouchableOpacity
              style={[styles.line, now && styles.lineNow]}
              onPress={() => onSeek?.(l.at)}
              activeOpacity={0.7}
              accessibilityLabel={`Play from ${formatClock(l.at)}: ${l.text}`}
            >
              <Text style={styles.at}>{formatClock(l.at)}</Text>
              <Text style={[styles.text, now && styles.textNow]}>{l.text}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
      {lines.length > PREVIEW ? (
        <TouchableOpacity onPress={() => setOpen((o) => !o)} style={styles.more}>
          <Text style={styles.moreText}>{open ? 'Show less' : 'Read it all'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: space.lg,
    marginBottom: space.xl,
  },
  heading: {
    fontFamily: type.moment.fontFamily,
    fontSize: 21,
    lineHeight: 26,
    color: colors.ink,
    marginBottom: space.md,
  },
  quiet: {
    ...type.bodySm,
    color: colors.inkMuted,
  },
  who: {
    ...type.h3,
    marginTop: space.md,
    marginBottom: space.xs,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
    borderRadius: radius.sm,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  lineNow: {
    backgroundColor: colors.accentSurface,
  },
  at: {
    ...type.time,
    color: colors.inkMuted,
    width: 52,
    paddingTop: 2,
  },
  text: {
    ...type.body,
    flex: 1,
    color: colors.inkSoft,
  },
  textNow: {
    color: colors.ink,
  },
  more: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
  },
  moreText: {
    ...type.label,
    color: colors.emberInk,
  },
});
