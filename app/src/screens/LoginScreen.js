import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fonts } from '../theme/typography';
import { type } from '../theme/type';
import { radius, elevation, layout, space } from '../theme/space';
import PressableScale from '../components/PressableScale';

export default function LoginScreen({ onBack }) {
  const { login, signup, requestPasswordReset } = useAuth();
  const toast = useToast();
  const [isSignup, setIsSignup] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // { type: 'error' | 'success', text } — shown inline since RN's Alert is a
  // no-op on web, where this app primarily runs.
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit() {
    setFeedback(null);

    if (resetMode) {
      if (!email.trim()) {
        setFeedback({ type: 'error', text: 'Enter your email to get a reset link.' });
        return;
      }
      setSubmitting(true);
      try {
        await requestPasswordReset(email.trim());
        setFeedback({
          type: 'success',
          text: `If ${email.trim()} has an account, a reset link is on its way. Check your inbox.`,
        });
      } catch (err) {
        setFeedback({ type: 'error', text: err.message || 'Could not send a reset link.' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      setFeedback({ type: 'error', text: 'Please fill in your email and password.' });
      return;
    }
    if (isSignup && !name.trim()) {
      setFeedback({ type: 'error', text: 'Please enter your name.' });
      return;
    }

    setSubmitting(true);
    try {
      if (isSignup) {
        const result = await signup(
          email.trim(),
          password,
          name.trim(),
          inviteCode.trim() || undefined,
        );
        if (result?.alreadyRegistered) {
          // No email goes out for an existing address — point them at logging in
          // rather than a confirmation that will never arrive.
          setIsSignup(false);
          setFeedback({
            type: 'error',
            text: `${email.trim()} already has an account. Try logging in (or reset your password).`,
          });
          return;
        }
        if (result?.needsConfirmation) {
          setFeedback({
            type: 'success',
            text: `We've sent a confirmation link to ${email.trim()}. Check your inbox to finish signing up.`,
          });
        }
        // Signup succeeded, but the invite code didn't take — say so rather
        // than leaving them quietly unconnected.
        if (result?.inviteError) {
          toast.error("You're signed up, but that invite code didn't work — ask for a new one.");
        }
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setIsSignup(!isSignup);
    setResetMode(false);
    setName('');
    setInviteCode('');
    setFeedback(null);
  }

  function enterResetMode() {
    setResetMode(true);
    setFeedback(null);
  }

  function exitResetMode() {
    setResetMode(false);
    setFeedback(null);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.6}>
            <Ionicons name="chevron-back" size={20} color={colors.inkMuted} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.header}>
          <Text style={styles.logo}>cozycast</Text>
          <Text style={styles.tagline}>for the conversations worth keeping</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {resetMode ? 'Reset your password' : isSignup ? 'Create your account' : 'Welcome back'}
          </Text>

          {feedback && (
            <View
              style={[
                styles.feedback,
                feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  feedback.type === 'success'
                    ? styles.feedbackTextSuccess
                    : styles.feedbackTextError,
                ]}
              >
                {feedback.text}
              </Text>
            </View>
          )}

          {isSignup && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.inkFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {!resetMode && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={colors.inkFaint}
                secureTextEntry
              />
              {!isSignup && (
                <TouchableOpacity
                  style={styles.forgotButton}
                  onPress={enterResetMode}
                  activeOpacity={0.6}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {isSignup && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Invite code (optional)</Text>
              <TextInput
                style={styles.input}
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="Enter an invite code"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <PressableScale
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {resetMode ? 'Send reset link' : isSignup ? 'Sign up' : 'Log in'}
              </Text>
            )}
          </PressableScale>

          {resetMode ? (
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={exitResetMode}
              activeOpacity={0.6}
            >
              <Text style={styles.toggleText}>Back to log in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.toggleButton} onPress={toggleMode} activeOpacity={0.6}>
              <Text style={styles.toggleText}>
                {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    width: '100%',
    maxWidth: layout.form,
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 15,
    color: colors.inkMuted,
    fontFamily: fonts.medium,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    ...type.display,
    fontSize: 42,
    lineHeight: 48,
    color: colors.ember,
    letterSpacing: -1,
  },
  tagline: {
    ...type.bodySm,
    fontSize: 15,
    color: colors.inkMuted,
    marginTop: space.sm,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 28,
    ...elevation.rest,
  },
  cardTitle: {
    ...type.h2,
    color: colors.ink,
    marginBottom: space.xl,
    textAlign: 'center',
  },
  feedback: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  feedbackError: {
    backgroundColor: colors.dangerSurface,
  },
  feedbackSuccess: {
    backgroundColor: colors.successSurface,
  },
  feedbackText: {
    ...type.label,
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackTextError: {
    color: colors.emberInk,
  },
  feedbackTextSuccess: {
    color: colors.success,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    ...type.label,
    color: colors.inkSoft,
    marginBottom: space.xs + 2,
    marginLeft: space.xs,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: space.sm,
    paddingVertical: 2,
  },
  forgotText: {
    ...type.label,
    color: colors.emberInk,
  },
  button: {
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
    marginTop: space.sm,
    ...elevation.raised,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...type.h3,
    fontSize: 17,
    color: colors.onEmber,
  },
  toggleButton: {
    marginTop: space.lg + 4,
    alignItems: 'center',
  },
  toggleText: {
    ...type.label,
    fontSize: 14,
    color: colors.emberInk,
  },
});
