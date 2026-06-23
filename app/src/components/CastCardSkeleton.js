import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

// A placeholder card shown while the feed loads — a soft pulsing silhouette of a
// real CastCard, which feels calmer than a bare spinner.
export default function CastCardSkeleton() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Animated.View style={[styles.cover, { opacity }]} />
        <View style={styles.headerText}>
          <Animated.View style={[styles.line, { width: '70%', opacity }]} />
          <Animated.View style={[styles.line, { width: '40%', opacity, marginTop: 8 }]} />
        </View>
      </View>
      <Animated.View style={[styles.line, { width: '95%', opacity, marginTop: 16 }]} />
      <Animated.View style={[styles.line, { width: '85%', opacity, marginTop: 8 }]} />
      <Animated.View style={[styles.player, { opacity }]} />
    </View>
  );
}

const BLOCK = '#EFE6DC';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: BLOCK,
  },
  headerText: {
    flex: 1,
    marginLeft: 14,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: BLOCK,
  },
  player: {
    height: 38,
    borderRadius: 19,
    backgroundColor: BLOCK,
    marginTop: 18,
  },
});
