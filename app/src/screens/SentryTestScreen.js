import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';

// TEMPORARY: a self-serve Sentry verification panel, shown only when the URL
// contains ?sentrytest. Lets us confirm events reach Sentry from a real
// browser. Remove once source maps / monitoring are settled (see issue #5).
export default function SentryTestScreen() {
  const [status, setStatus] = useState('');

  function sendCaptured() {
    const id = Sentry.captureException(
      new Error('cozycast manual test error (captureException) ' + new Date().toISOString()),
    );
    setStatus(`Sent a captured error to Sentry (event id ${id}). Check the react-native project.`);
  }

  function throwUncaught() {
    throw new Error('cozycast manual test error (uncaught) ' + new Date().toISOString());
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sentry test</Text>
      <Text style={styles.subtitle}>
        Trigger an error to confirm reporting works. Then look in the Sentry cozycast project
        (environment: production).
      </Text>

      <TouchableOpacity style={styles.button} onPress={sendCaptured} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Send test error (captureException)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonAlt]}
        onPress={throwUncaught}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Throw an uncaught error</Text>
      </TouchableOpacity>

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E8734A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#8C7B6B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  button: {
    backgroundColor: '#E8734A',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 14,
  },
  buttonAlt: {
    backgroundColor: '#C0392B',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    marginTop: 16,
    fontSize: 13,
    color: '#3B7A3F',
    textAlign: 'center',
    lineHeight: 19,
  },
});
