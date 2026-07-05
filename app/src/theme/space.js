// Spacing (4pt base), radius, and warm elevation tokens. See docs/design-vision.md.
import colors from './colors';

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

// Web is the primary target: on wide viewports every surface reads inside a
// centered column of at most `layout.column`, like a page in a book — a
// lamp-lit room, not a widescreen dashboard.
export const layout = {
  column: 640,
  form: 480, // lone form cards (login, reset) read best a little narrower
};

export const radius = {
  sm: 12, // fields, chips, comments
  md: 18, // cards
  pill: 999, // avatars, buttons, play controls
};

// Three elevation levels with a WARM shadow (never pure black).
export const elevation = {
  rest: {
    shadowColor: '#7A5A3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  raised: {
    shadowColor: '#7A5A3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
};

export { colors };
