import React from 'react';
import { View, StyleSheet } from 'react-native';
import FeedScreen from '../src/screens/FeedScreen';
import RecordScreen from '../src/screens/RecordScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import MiniPlayer from '../src/components/MiniPlayer';
import TabBar from '../src/components/TabBar';
import { useShell } from '../src/context/ShellContext';
import useLayout from '../src/hooks/useLayout';
import { colors } from '../src/theme/colors';

// The signed-in home. Tabs stay local state (they were never URLs) — held in
// ShellContext so the laptop rail (rendered by the root layout) can switch them
// from any route. The router is what gives us the separate, shareable /cast/:id
// detail route.
//
// Phone: one column, a slim tab bar with a raised Record button, and the
// MiniPlayer docked above it. Laptop: the root layout supplies the rail and
// now-playing panel; the MiniPlayer covers the in-between widths.
export default function Home() {
  const { tab, setTab } = useShell();
  const { wide } = useLayout();

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        {tab === 'feed' && <FeedScreen />}
        {tab === 'record' && <RecordScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </View>
      <MiniPlayer />
      {!wide ? <TabBar active={tab} onNavigate={setTab} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
  },
});
