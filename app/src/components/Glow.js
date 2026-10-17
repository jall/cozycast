import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

let seq = 0;

// Soft firelight: a radial gradient that fades to nothing well before its box
// edges, so it never shows a seam. Size and place it with `style` (it fills its
// box); `strength` is the opacity at the centre.
export default function Glow({ color = '#FF7A3D', strength = 0.55, style }) {
  const id = useRef(`glow-${(seq += 1)}`).current;
  return (
    <View pointerEvents="none" style={[styles.box, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity={strength} />
            <Stop offset="0.45" stopColor={color} stopOpacity={strength * 0.3} />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100" height="100" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
