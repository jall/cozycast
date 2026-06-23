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
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fonts } from '../theme/typography';

export default function ResetPasswordScreen() {
  const { updatePassword, logout } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    setError(null);
    if (password.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      toast.success('Password updated — welcome back 🌿');
    } catch (err) {
      setError(err.message || 'Could not update your password. Try the link again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>cozycast</Text>
          <Text style={styles.tagline}>choose a new password</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Set a new password</Text>

          {error && (
            <View style={styles.feedback}>
              <Text style={styles.feedbackText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor="#C4B5A8"
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Type it again"
              placeholderTextColor="#C4B5A8"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Update password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={logout} activeOpacity={0.6}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
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
    fontFamily: fonts.regular,
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
    backgroundColor: '#FCEDE9',
    borderWidth: 1,
    borderColor: '#F3C9BD',
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.medium,
    color: '#B5482E',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.medium,
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
  cancelButton: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 4,
  },
  cancelText: {
    color: '#A89888',
    fontSize: 15,
    fontFamily: fonts.medium,
  },
});
