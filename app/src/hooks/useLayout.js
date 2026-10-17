import { useWindowDimensions } from 'react-native';
import { layout } from '../theme/space';

// The room's shape at this width: is the left rail showing, is the now-playing
// panel docked, and how wide is the space in between (what a screen actually
// gets to lay itself out in).
export default function useLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= layout.wide;
  const panel = width >= layout.panelAt;
  const content = width - (wide ? layout.rail : 0) - (panel ? layout.panel : 0);
  return { width, wide, panel, content };
}
