import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FeedScreen from '../src/screens/FeedScreen';
import RecordScreen from '../src/screens/RecordScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import MiniPlayer from '../src/components/MiniPlayer';
import { fonts } from '../src/theme/typography';

function TabBar({ active, onNavigate }) {
  const tabs = [
    { key: 'feed', label: 'Feed', icon: 'home' },
    { key: 'record', label: 'Record', icon: 'mic' },
    { key: 'profile', label: 'Profile', icon: 'person' },
  ];
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onNavigate(tab.key)}>
          <Ionicons name={tab.icon} size={24} color={active === tab.key ? '#E8734A' : '#B0A090'} />
          <Text style={[styles.tabLabel, active === tab.key && styles.tabLabelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
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
    backgroundColor: '#FFF8F0',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    height: 88,
    paddingTop: 8,
    paddingBottom: 28,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: '#B0A090',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#E8734A',
  },
});
