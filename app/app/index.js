import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FeedScreen from '../src/screens/FeedScreen';
import RecordScreen from '../src/screens/RecordScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import MiniPlayer from '../src/components/MiniPlayer';
import { colors } from '../src/theme/colors';
import { type } from '../src/theme/type';
import { space, layout } from '../src/theme/space';

function TabBar({ active, onNavigate }) {
  const tabs = [
    { key: 'feed', label: 'Home', icon: 'home' },
    { key: 'record', label: 'Record', icon: 'mic' },
    { key: 'profile', label: 'You', icon: 'person' },
  ];
  return (
    <View style={styles.tabBar}>
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const on = active === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onNavigate(tab.key)}>
              <Ionicons
                name={on ? tab.icon : `${tab.icon}-outline`}
                size={24}
                color={on ? colors.ember : colors.inkMuted}
              />
              <Text style={[styles.tabLabel, on && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// The signed-in home: the three primary surfaces behind a custom bottom tab
// bar. Tabs stay local state (they were never URLs); the router is what gives
// us the separate, shareable /cast/:id detail route.
export default function Home() {
  const [activeTab, setActiveTab] = useState('feed');

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        {activeTab === 'feed' && <FeedScreen />}
        {activeTab === 'record' && <RecordScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>
      <MiniPlayer />
      <TabBar active={activeTab} onNavigate={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // NB: must stay a column — tabRow centers itself horizontally via alignSelf,
  // which only works on the cross axis (a row parent pins it to the left edge
  // on wide viewports).
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    shadowColor: '#7A5A3A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
    height: 88,
    paddingTop: space.sm,
    paddingBottom: 28,
  },
  // Keep the tabs together in the reading column on wide viewports rather than
  // flinging Home and You to opposite corners of the window.
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    ...type.caption,
    fontFamily: type.label.fontFamily,
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: space.xs,
  },
  tabLabelActive: {
    color: colors.ember,
  },
});
