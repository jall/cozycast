import React from 'react';
import Svg, { Path } from 'react-native-svg';

// The brand mark: a two-tone flame. Sits beside the wordmark and anywhere the
// fire needs to be tiny.
export default function FlameMark({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden>
      <Path
        d="M16 3c3 5 8 8 8 15a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 2 5 4 5 0-5-2-8 0-12z"
        fill="#FF7A3D"
      />
      <Path
        d="M16 14c2 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1 1 2 2 2 0-2-1-4 0-6z"
        fill="#FFB547"
      />
    </Svg>
  );
}
