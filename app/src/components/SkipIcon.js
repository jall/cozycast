import React from 'react';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

// A circular-arrow skip glyph with the number of seconds inside — back 15 or
// forward 30, matching the media-session buttons.
export default function SkipIcon({ seconds, forward = false, size = 30, color = colors.ink }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {forward ? (
        <>
          <Path
            d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <Path
            d="M20 3.5v4h-4"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <Path
            d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <Path
            d="M4 3.5v4h4"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      <SvgText
        x="12"
        y="15.2"
        textAnchor="middle"
        fontSize="7"
        fontFamily={fonts.monoMedium}
        fill={color}
      >
        {String(seconds)}
      </SvgText>
    </Svg>
  );
}
