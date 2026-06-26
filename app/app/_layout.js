import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
// Import each weight by subpath so only these four faces are bundled (importing
// from the package root pulls in every Nunito weight as a build asset).
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { fonts } from '../src/theme/typography';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { PlayerProvider } from '../src/context/PlayerContext';
import { NotificationsProvider } from '../src/context/NotificationsContext';
import PublicRoot from '../src/screens/PublicRoot';
import ResetPasswordScreen from '../src/screens/ResetPasswordScreen';

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

// Decides what the signed-in vs signed-out app shows. When signed in we render
// the router <Stack> (so /cast/:id and the tab home resolve); otherwise we keep
// the existing public flow / password-recovery screen. Because the URL is
// untouched while signed out, a deep link to /cast/:id is preserved through
// login — the Stack mounts on that URL once a session exists.
function RootNav() {
  const { user, loading, passwordRecovery } = useAuth();

  if (loading) return <LoadingScreen />;
  // A reset link creates a session, so this must win over both the app and the
  // public surface until the new password is set.
  if (passwordRecovery) return <ResetPasswordScreen />;
  if (!user) return <PublicRoot />;

  // The MiniPlayer is rendered per-screen (it sits above the tab bar on the
  // home route, and at the bottom of the cast detail route). Audio lives in
  // PlayerContext, so it keeps playing seamlessly across navigations.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFF8F0' },
        animation: 'fade',
      }}
    />
  );
}

function RootLayout() {
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
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <SafeAreaProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationsProvider>
              <PlayerProvider>
                <RootNav />
              </PlayerProvider>
            </NotificationsProvider>
          </AuthProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </Sentry.ErrorBoundary>
  );
}

// Last-resort UI if a render throws — a calm message instead of a blank SPA.
// (Sentry still reports the error when a DSN is configured.)
function ErrorFallback() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingLogo}>cozycast</Text>
      <Text style={styles.errorText}>Something went quiet unexpectedly.</Text>
      {Platform.OS === 'web' ? (
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => window.location.reload()}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Reload</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Wrap with Sentry only when it's enabled, so the app is untouched otherwise.
export default sentryDsn ? Sentry.wrap(RootLayout) : RootLayout;

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
  errorText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#8C7B6B',
    marginTop: 16,
  },
  errorButton: {
    marginTop: 20,
    backgroundColor: '#E8734A',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: fonts.bold,
  },
});
