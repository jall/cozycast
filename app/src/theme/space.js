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

// Web is the primary target. On a phone the app is a single column with a slim
// tab bar; from `layout.wide` up it becomes a three-part room — a left rail
// (`layout.rail`), the feed, and (from `layout.panelAt`) a docked now-playing
// panel (`layout.panel`) — so a laptop is filled with the fire, not washed out
// by empty margins.
export const layout = {
  column: 640, // single-column reading width (forms, detail on a phone)
  feed: 780, // the feed column when the rail is showing
  form: 480, // lone form cards (login, reset) read best a little narrower
  wide: 860, // rail replaces the bottom tab bar from here
  panelAt: 1180, // now-playing panel docks on the right from here
  rail: 248,
  panel: 400,
};

export const radius = {
  sm: 12, // fields, chips, comments
  md: 22, // cards
  lg: 28, // hero panels, big covers
  pill: 999, // avatars, buttons, play controls
};

// Elevation on night: shadows deepen the dark rather than lift off a page, and
// the one *glow* is warm — reserved for what's alive (the playing card, the
// play button, record).
export const elevation = {
  rest: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 2,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 6,
  },
  glow: {
    shadowColor: '#FF7A3D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 8,
  },
};

export { colors };
