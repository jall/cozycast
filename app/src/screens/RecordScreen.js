import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecordScreen() {
  const [mode, setMode] = useState(null); // null | 'recording' | 'recorded' | 'form'
  const [recording, setRecording] = useState(null);
  const [recordingUri, setRecordingUri] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef(null);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow microphone access to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(rec);
      setElapsed(0);
      setMode('recording');

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      Alert.alert('Recording failed', err.message || 'Could not start recording.');
    }
  }

  async function stopRecording() {
    clearInterval(timerRef.current);
    timerRef.current = null;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);
      setMode('form');
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not stop recording.');
      setMode(null);
    }
  }

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setRecordingUri(asset.uri);
        setMode('form');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick file.');
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Give your cast a title.');
      return;
    }
    if (!recordingUri) {
      Alert.alert('No audio', 'Please record audio first.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      const participantList = participants
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (participantList.length > 0) {
        formData.append('participants', JSON.stringify(participantList));
      }

      const fileInfo = await FileSystem.getInfoAsync(recordingUri);
      const fileName = recordingUri.split('/').pop() || 'recording.m4a';

      formData.append('audio', {
        uri: recordingUri,
        name: fileName,
        type: 'audio/m4a',
      });

      await client.postMultipart('/casts', formData);

      Alert.alert('Shared!', 'Your cast has been shared with friends.');
      resetState();
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Could not upload your cast.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetState() {
    setMode(null);
    setRecordingUri(null);
    setElapsed(0);
    setTitle('');
    setDescription('');
    setParticipants('');
    setRecording(null);
  }

  function renderChoiceScreen() {
    return (
      <View style={styles.choiceContainer}>
        <Text style={styles.screenTitle}>New Cast</Text>
        <Text style={styles.screenSubtitle}>
          Share a little audio moment with your people
        </Text>

        <TouchableOpacity
          style={styles.choiceCard}
          onPress={startRecording}
          activeOpacity={0.8}
        >
          <View style={styles.choiceIconWrap}>
            <Ionicons name="mic" size={32} color="#E8734A" />
          </View>
          <View style={styles.choiceTextWrap}>
            <Text style={styles.choiceTitle}>Record</Text>
            <Text style={styles.choiceDesc}>
              Record something right now
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.choiceCard}
          onPress={handlePickFile}
          activeOpacity={0.8}
        >
          <View style={styles.choiceIconWrap}>
            <Ionicons name="document-outline" size={32} color="#F4A261" />
          </View>
          <View style={styles.choiceTextWrap}>
            <Text style={styles.choiceTitle}>Pick a File</Text>
            <Text style={styles.choiceDesc}>
              Upload an existing audio file
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  function renderRecordingScreen() {
    return (
      <View style={styles.recordingContainer}>
        <Text style={styles.recordingLabel}>Recording...</Text>
        <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>

        <View style={styles.pulseWrap}>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={stopRecording}
            activeOpacity={0.8}
          >
            <View style={styles.stopSquare} />
          </TouchableOpacity>
        </View>

        <Text style={styles.recordingHint}>Tap to stop</Text>
      </View>
    );
  }

  function renderForm() {
    return (
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Almost there</Text>
        <Text style={styles.screenSubtitle}>
          Add some details to your cast
        </Text>

        <View style={styles.audioPreviewRow}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          <Text style={styles.audioPreviewText}>
            Audio recorded ({formatElapsed(elapsed)})
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What's this about?"
            placeholderTextColor="#C4B5A8"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="A little context..."
            placeholderTextColor="#C4B5A8"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Participants (optional)</Text>
          <TextInput
            style={styles.input}
            value={participants}
            onChangeText={setParticipants}
            placeholder="Names, separated by commas"
            placeholderTextColor="#C4B5A8"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>Share Cast</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={resetState}
          activeOpacity={0.6}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {mode === null && renderChoiceScreen()}
      {mode === 'recording' && renderRecordingScreen()}
      {mode === 'form' && renderForm()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },

  // Choice screen
  choiceContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 8,
  },
  screenSubtitle: {
    fontSize: 15,
    color: '#8C7B6B',
    marginBottom: 36,
  },
  choiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  choiceIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  choiceTextWrap: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 4,
  },
  choiceDesc: {
    fontSize: 14,
    color: '#8C7B6B',
  },

  // Recording screen
  recordingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  recordingLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8734A',
    marginBottom: 12,
  },
  elapsed: {
    fontSize: 48,
    fontWeight: '200',
    color: '#2D2D2D',
    fontVariant: ['tabular-nums'],
    marginBottom: 48,
  },
  pulseWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(232, 115, 74, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8734A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E8734A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  stopSquare: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  recordingHint: {
    fontSize: 14,
    color: '#A89888',
  },

  // Form
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
  },
  audioPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FAF0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 28,
  },
  audioPreviewText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B5E50',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2D2D2D',
    borderWidth: 1,
    borderColor: '#F0E6DA',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  submitButton: {
    backgroundColor: '#E8734A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#E8734A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#A89888',
    fontSize: 15,
    fontWeight: '500',
  },
});
