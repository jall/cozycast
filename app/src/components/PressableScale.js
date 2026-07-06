import React, { useRef, useState } from 'react';
import { Animated, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Press = settle, not flash. A soft spring to 0.97 replaces the opacity
// blink of TouchableOpacity on the surfaces people touch most. On web it
// also carries a gentle hover treatment (pass `hoverStyle`, e.g. a raised
// warm shadow) so the desktop app feels intentional rather than ported.
export default function PressableScale({ style, hoverStyle, children, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);

  function settle(to) {
    Animated.spring(scale, {
      toValue: to,
      speed: 30,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => settle(0.97)}
      onPressOut={() => settle(1)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[style, hovered && !disabled && hoverStyle, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
