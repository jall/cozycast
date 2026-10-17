import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { waveformShape } from '../utils/peaks';
import { colors } from '../theme/colors';

// A cast's shape as a row of soft bars (its measured `peaks` when it has them,
// else the id-seeded portrait), with what you've heard so far lit in
// ember. Purely decorative unless `onSeek` is given — then it's the scrubber:
// press or drag anywhere to move the playhead (committed on release so we
// don't flood the audio engine), and arrow keys / screen-reader adjust call
// `onStep(±1)`. (PlayerDeck draws timestamped notes as dots above it.)
// A cast made in turns passes `bands` ([{ start, end, color }], fractions of
// the whole): each turn is drawn in its maker's colour, dimmed until heard.
export default function Waveform({
  seed,
  peaks,
  bars = 48,
  height = 28,
  progress = 0,
  playedColor = colors.ember,
  idleColor = colors.smoke,
  onSeek,
  onStep,
  playhead = false,
  bands,
  accessibilityValueText,
  style,
}) {
  const shape = useMemo(() => waveformShape(peaks, seed, bars), [peaks, seed, bars]);
  const box = useRef({ x: 0, width: 0 });
  const viewRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const shown = drag ?? Math.min(1, Math.max(0, progress || 0));

  function measure() {
    viewRef.current?.measureInWindow?.((x, _y, width) => {
      if (width) box.current = { x, width };
    });
  }

  function fractionAt(e) {
    const { x, width } = box.current;
    const pageX = e.nativeEvent.pageX;
    if (!width || typeof pageX !== 'number') return null;
    return Math.min(1, Math.max(0, (pageX - x) / width));
  }

  const seekable = typeof onSeek === 'function';

  const responder = seekable
    ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderTerminationRequest: () => false,
        onResponderGrant: (e) => {
          measure();
          const f = fractionAt(e);
          if (f != null) setDrag(f);
        },
        onResponderMove: (e) => {
          const f = fractionAt(e);
          if (f != null) setDrag(f);
        },
        onResponderRelease: (e) => {
          const f = fractionAt(e) ?? drag;
          setDrag(null);
          if (f != null) onSeek(f);
        },
        onResponderTerminate: () => setDrag(null),
      }
    : {};

  const a11y = seekable
    ? {
        accessible: true,
        accessibilityRole: 'adjustable',
        accessibilityLabel: 'Seek',
        accessibilityValue: {
          min: 0,
          max: 100,
          now: Math.round(shown * 100),
          text: accessibilityValueText,
        },
        accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
        onAccessibilityAction: (e) => onStep?.(e.nativeEvent.actionName === 'increment' ? 1 : -1),
        focusable: true,
        ...(Platform.OS === 'web'
          ? {
              onKeyDown: (e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault?.();
                  onStep?.(1);
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault?.();
                  onStep?.(-1);
                }
              },
            }
          : null),
      }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

  return (
    <View
      ref={viewRef}
      onLayout={measure}
      style={[styles.row, { height }, seekable && styles.seekable, style]}
      {...responder}
      {...a11y}
    >
      {shape.map((v, i) => {
        const f = (i + 0.5) / shape.length;
        const heard = f <= shown;
        const band = bands?.length ? bandAt(bands, f) : null;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.bar,
              {
                height: Math.max(3, Math.round(v * height)),
                backgroundColor: band ? band.color : heard ? playedColor : idleColor,
              },
              band && !heard ? styles.unheard : null,
            ]}
          />
        );
      })}
      {playhead ? (
        <View
          pointerEvents="none"
          style={[styles.playhead, { left: `${shown * 100}%`, top: -4, bottom: -4 }]}
        />
      ) : null}
    </View>
  );
}

function bandAt(bands, f) {
  return bands.find((b) => f >= b.start && f < b.end) || bands[bands.length - 1];
}

const styles = StyleSheet.create({
  unheard: {
    opacity: 0.35,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seekable: Platform.select({ web: { cursor: 'pointer', outlineStyle: 'none' }, default: {} }),
  bar: {
    flex: 1,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  playhead: {
    position: 'absolute',
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: colors.ink,
    shadowColor: colors.emberSoft,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
