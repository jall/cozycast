import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
// Import each weight by subpath so only these four faces are bundled (importing
// from the package root pulls in every Nunito weight as a build asset).
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { fonts } from './src/theme/typography';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import LandingScreen from './src/screens/LandingScreen';
import ManifestoScreen from './src/screens/ManifestoScreen';
import LoginScreen from './src/screens/LoginScreen';
import FeedScreen from './src/screens/FeedScreen';
import RecordScreen from './src/screens/RecordScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Error tracking. 12-factor: the DSN comes from the environment, never the
// repo. Set EXPO_PUBLIC_SENTRY_DSN (Netlify build env / local .env); without
// it, Sentry stays off.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    // Tie events to the deployed git commit (set in the Netlify build) so
    // Sentry can do release health, regressions, and suspect commits.
    release: process.env.EXPO_PUBLIC_COMMIT_REF || undefined,
    // Only report from real builds — keep local dev noise out of Sentry.
    enabled: !__DEV__,
    // Low pre-v1 volume — full traces are fine; dial down before scaling up.
    tracesSampleRate: 1.0,
    // Keep PII off until we've reviewed exactly what we'd be collecting.
    sendDefaultPii: false,
  });
}

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingLogo}>cozycast</Text>
      <ActivityIndicator size="large" color="#E8734A" style={{ marginTop: 24 }} />
    </View>
  );
}

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

// The public, unauthenticated surface: landing → sign in, plus the manifesto.
function PublicRoot() {
  const [view, setView] = useState('landing'); // 'landing' | 'login' | 'manifesto'

  if (view === 'login') return <LoginScreen onBack={() => setView('landing')} />;
  if (view === 'manifesto') return <ManifestoScreen onBack={() => setView('landing')} />;
  return (
    <LandingScreen
      onGetStarted={() => setView('login')}
      onOpenManifesto={() => setView('manifesto')}
    />
  );
}

function AppRoot() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');

  if (loading) return <LoadingScreen />;
  if (!user) return <PublicRoot />;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF8F0' }}>
      <View style={{ flex: 1 }}>
        {activeTab === 'feed' && <FeedScreen />}
        {activeTab === 'record' && <RecordScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>
      <TabBar active={activeTab} onNavigate={setActiveTab} />
    </View>
  );
}

function App() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  // Hold the splash until fonts are ready (or fail) so we never flash a
  // system-font frame before the cozy one loads.
  if (!fontsLoaded && !fontError) return <LoadingScreen />;

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRoot />
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

// Wrap with Sentry only when it's enabled, so the app is untouched otherwise.
export default sentryDsn ? Sentry.wrap(App) : App;

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: 36,
    fontFamily: fonts.display,
    color: '#E8734A',
    letterSpacing: -1,
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
