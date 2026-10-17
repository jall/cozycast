import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import FeedScreen from '../src/screens/FeedScreen';
import RecordScreen from '../src/screens/RecordScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import MiniPlayer from '../src/components/MiniPlayer';
import Sidebar from '../src/components/Sidebar';
import TabBar from '../src/components/TabBar';
import NowPlayingPanel from '../src/components/NowPlayingPanel';
import { colors } from '../src/theme/colors';
import { layout } from '../src/theme/space';

// The signed-in home. Tabs stay local state (they were never URLs); the router
// is what gives us the separate, shareable /cast/:id detail route.
//
// Phone: one column, a slim tab bar with a raised Record button, and the
// MiniPlayer docked above it. Laptop (`layout.wide`+): a left rail replaces the
// tab bar so the screen is filled rather than a narrow strip in a wash of
// margin; from `layout.panelAt` the now-playing panel docks on the right
// (otherwise the MiniPlayer sits under the content).
export default function Home() {
  const [activeTab, setActiveTab] = useState('feed');
  const { width } = useWindowDimensions();
  const wide = width >= layout.wide;
  const panel = width >= layout.panelAt;

  const screen = (
    <View style={styles.screen}>
      {activeTab === 'feed' && <FeedScreen />}
      {activeTab === 'record' && <RecordScreen />}
      {activeTab === 'profile' && <ProfileScreen />}
    </View>
  );

  if (!wide) {
    return (
      <View style={styles.container}>
        {screen}
        <MiniPlayer />
        <TabBar active={activeTab} onNavigate={setActiveTab} />
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.room]}>
      <Sidebar active={activeTab} onNavigate={setActiveTab} />
      <View style={styles.main}>
        {screen}
        {!panel ? <MiniPlayer /> : null}
      </View>
      {panel ? <NowPlayingPanel /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  room: {
    flexDirection: 'row',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  screen: {
    flex: 1,
  },
});
