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
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces/500Medium_Italic';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono/400Regular';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono/500Medium';
import { StatusBar } from 'expo-status-bar';
import { fonts } from '../src/theme/typography';
import { colors } from '../src/theme/colors';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { PlayerProvider } from '../src/context/PlayerContext';
import { NotificationsProvider } from '../src/context/NotificationsContext';
import { ShellProvider } from '../src/context/ShellContext';
import Sidebar from '../src/components/Sidebar';
import NowPlayingPanel from '../src/components/NowPlayingPanel';
import usePendingInvite from '../src/hooks/usePendingInvite';
import useLayout from '../src/hooks/useLayout';
import { captureInviteFromLocation } from '../src/utils/invites';

import PublicRoot from '../src/screens/PublicRoot';
import ResetPasswordScreen from '../src/screens/ResetPasswordScreen';
import FlameMark from '../src/components/FlameMark';

// Opened from an invite link (/invite/CODE)? Stash the code and tidy the URL
// before the router reads it; it's redeemed once there's a session.
captureInviteFromLocation();

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
      <FlameMark size={44} />
      <ActivityIndicator size="small" color={colors.ember} style={{ marginTop: 20 }} />
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

  return <SignedIn />;
}

// The signed-in app. On a phone it's just the router (each screen brings its
// own tab bar / mini player). From `layout.wide` up it's a three-part room that
// stays put across every route — the rail on the left, the routed screen in the
// middle, and (from `layout.panelAt`) the now-playing panel on the right — so
// opening notifications or a cast never drops you out of it. Audio lives in
// PlayerContext, so it keeps playing seamlessly across navigations.
function SignedIn() {
  const { wide, panel } = useLayout();
  usePendingInvite();

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    />
  );

  if (!wide) return stack;
  return (
    <View style={styles.room}>
      <Sidebar />
      <View style={styles.main}>{stack}</View>
      {panel ? <NowPlayingPanel /> : null}
    </View>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_500Medium_Italic,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  // Hold the splash until fonts are ready (or fail) so we never flash a
  // system-font frame before the cozy one loads.
  if (!fontsLoaded && !fontError) return <LoadingScreen />;

  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ToastProvider>
          <AuthProvider>
            <NotificationsProvider>
              <PlayerProvider>
                <ShellProvider>
                  <RootNav />
                </ShellProvider>
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
  room: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: 36,
    fontFamily: fonts.serifBold,
    color: colors.ink,
    letterSpacing: -1,
  },
  errorText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.inkSoft,
    marginTop: 16,
  },
  errorButton: {
    marginTop: 20,
    backgroundColor: colors.ember,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  errorButtonText: {
    color: colors.onEmber,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
});
