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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fonts } from '../theme/typography';

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
            <Ionicons name="chevron-back" size={20} color="#8C7B6B" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.header}>
          <Text style={styles.logo}>cozycast</Text>
          <Text style={styles.tagline}>share moments with the people who matter</Text>
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
                placeholderTextColor="#C4B5A8"
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
              placeholderTextColor="#C4B5A8"
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
                placeholderTextColor="#C4B5A8"
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
              <Text style={styles.label}>Invite Code (optional)</Text>
              <TextInput
                style={styles.input}
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="Enter an invite code"
                placeholderTextColor="#C4B5A8"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>
                {resetMode ? 'Send reset link' : isSignup ? 'Sign Up' : 'Log In'}
              </Text>
            )}
          </TouchableOpacity>

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
    backgroundColor: '#FFF8F0',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
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
    color: '#8C7B6B',
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    fontSize: 42,
    fontFamily: fonts.display,
    color: '#E8734A',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: '#8C7B6B',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
    marginBottom: 24,
    textAlign: 'center',
  },
  feedback: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  feedbackError: {
    backgroundColor: '#FCEDE9',
    borderWidth: 1,
    borderColor: '#F3C9BD',
  },
  feedbackSuccess: {
    backgroundColor: '#EDF7EE',
    borderWidth: 1,
    borderColor: '#C3E2C6',
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  feedbackTextError: {
    color: '#B5482E',
  },
  feedbackTextSuccess: {
    color: '#3B7A3F',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B5E50',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2D2D2D',
    borderWidth: 1,
    borderColor: '#F0E6DA',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 2,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#E8734A',
  },
  button: {
    backgroundColor: '#E8734A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#E8734A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: fonts.bold,
  },
  toggleButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleText: {
    color: '#E8734A',
    fontSize: 14,
    fontWeight: '500',
  },
});
