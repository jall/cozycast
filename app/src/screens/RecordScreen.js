import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { createCast, shareCast, getFriends } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../utils/alert';

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function initial(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

// A tappable person row used for tagging participants and picking recipients.
function PersonRow({ person, selected, onToggle }) {
  return (
    <TouchableOpacity style={styles.personRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.personAvatar}>
        <Text style={styles.personAvatarText}>{initial(person.name)}</Text>
      </View>
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{person.name}</Text>
        {person.email ? <Text style={styles.personEmail}>{person.email}</Text> : null}
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={selected ? '#E8734A' : '#D4C5B5'}
      />
    </TouchableOpacity>
  );
}

export default function RecordScreen() {
  const { user } = useAuth();
  // null | 'recording' | 'form' | 'recipients' | 'done'
  const [mode, setMode] = useState(null);
  const [recording, setRecording] = useState(null);
  const [recordingUri, setRecordingUri] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [friends, setFriends] = useState([]);
  const [participantIds, setParticipantIds] = useState([]);
  const [sharerId, setSharerId] = useState('me');
  const [recipientIds, setRecipientIds] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [createdCast, setCreatedCast] = useState(null);

  const timerRef = useRef(null);

  useEffect(() => {
    getFriends()
      .then(setFriends)
      .catch(() => setFriends([]));
  }, []);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission needed', 'Please allow microphone access to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      setRecording(rec);
      setElapsed(0);
      setMode('recording');

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      showAlert('Recording failed', err.message || 'Could not start recording.');
    }
  }

  async function stopRecording() {
    clearInterval(timerRef.current);
    timerRef.current = null;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);
      setMode('form');
    } catch (err) {
      showAlert('Error', err.message || 'Could not stop recording.');
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
        setRecordingUri(result.assets[0].uri);
        setMode('form');
      }
    } catch {
      showAlert('Error', 'Could not pick file.');
    }
  }

  function toggle(list, setList, id) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function toggleParticipant(id) {
    const next = participantIds.includes(id)
      ? participantIds.filter((x) => x !== id)
      : [...participantIds, id];
    setParticipantIds(next);
    // If the assigned sharer is no longer a participant, fall back to you.
    if (sharerId !== 'me' && !next.includes(sharerId)) setSharerId('me');
  }

  async function handleCreate() {
    if (!title.trim()) {
      showAlert('Missing title', 'Give your cast a title.');
      return;
    }
    if (!recordingUri) {
      showAlert('No audio', 'Please record or pick audio first.');
      return;
    }

    setSubmitting(true);
    try {
      const participants = friends
        .filter((f) => participantIds.includes(f.id))
        .map((f) => ({ id: f.id, name: f.name }));

      const cast = await createCast({
        title: title.trim(),
        summary: summary.trim() || null,
        audioUri: recordingUri,
        duration: elapsed || null,
        participants,
        sharerId: sharerId === 'me' ? user?.id : sharerId,
      });

      setCreatedCast(cast);
      setMode('recipients');
    } catch (err) {
      showAlert('Upload failed', err.message || 'Could not create your cast.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    setSubmitting(true);
    try {
      await shareCast(createdCast.id, recipientIds);
      setMode('done');
    } catch (err) {
      showAlert('Could not share', err.message || 'Your cast was saved but sharing failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetState() {
    setMode(null);
    setRecordingUri(null);
    setElapsed(0);
    setTitle('');
    setSummary('');
    setParticipantIds([]);
    setSharerId('me');
    setRecipientIds([]);
    setRecording(null);
    setCreatedCast(null);
  }

  function renderChoiceScreen() {
    return (
      <View style={styles.choiceContainer}>
        <Text style={styles.screenTitle}>New Cast</Text>
        <Text style={styles.screenSubtitle}>Record a conversation, then choose who hears it</Text>

        <TouchableOpacity
          testID="record-start"
          style={styles.choiceCard}
          onPress={startRecording}
          activeOpacity={0.8}
        >
          <View style={styles.choiceIconWrap}>
            <Ionicons name="mic" size={32} color="#E8734A" />
          </View>
          <View style={styles.choiceTextWrap}>
            <Text style={styles.choiceTitle}>Record</Text>
            <Text style={styles.choiceDesc}>Record something right now</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          testID="record-pick"
          style={styles.choiceCard}
          onPress={handlePickFile}
          activeOpacity={0.8}
        >
          <View style={styles.choiceIconWrap}>
            <Ionicons name="document-outline" size={32} color="#F4A261" />
          </View>
          <View style={styles.choiceTextWrap}>
            <Text style={styles.choiceTitle}>Pick a File</Text>
            <Text style={styles.choiceDesc}>Upload an existing audio file</Text>
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
            testID="record-stop"
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

  function renderSharerPicker() {
    const options = [
      { id: 'me', name: `${user?.name || 'You'} (you)` },
      ...friends.filter((f) => participantIds.includes(f.id)),
    ];
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Who shares this?</Text>
        <Text style={styles.helpText}>
          One person is responsible for deciding who receives this cast.
        </Text>
        <View style={styles.chipRow}>
          {options.map((o) => {
            const active = sharerId === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSharerId(o.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
        <Text style={styles.screenTitle}>Add some details</Text>
        <Text style={styles.screenSubtitle}>Tell people what this conversation was</Text>

        <View style={styles.audioPreviewRow}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          <Text style={styles.audioPreviewText}>
            Audio ready{elapsed ? ` (${formatElapsed(elapsed)})` : ''}
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
          <Text style={styles.label}>Summary (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={summary}
            onChangeText={setSummary}
            placeholder="A little about the conversation..."
            placeholderTextColor="#C4B5A8"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Who was in the conversation?</Text>
          {friends.length === 0 ? (
            <Text style={styles.helpText}>
              Add friends from your Profile to tag them as participants.
            </Text>
          ) : (
            <View style={styles.personList}>
              {friends.map((f) => (
                <PersonRow
                  key={f.id}
                  person={f}
                  selected={participantIds.includes(f.id)}
                  onToggle={() => toggleParticipant(f.id)}
                />
              ))}
            </View>
          )}
        </View>

        {renderSharerPicker()}

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleCreate}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>Continue to sharing</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={resetState} activeOpacity={0.6}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderRecipients() {
    const sharerIsMe = sharerId === 'me' || sharerId === user?.id;
    return (
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Share with…</Text>
        <Text style={styles.screenSubtitle}>
          {sharerIsMe
            ? 'Pick exactly who receives this. No one else will ever see it.'
            : "You assigned someone else to share this — they'll choose the recipients."}
        </Text>

        {sharerIsMe ? (
          friends.length === 0 ? (
            <Text style={styles.helpText}>
              You have no friends to share with yet. Add some from your Profile, then share this
              cast later.
            </Text>
          ) : (
            <View style={styles.personList}>
              {friends.map((f) => (
                <PersonRow
                  key={f.id}
                  person={f}
                  selected={recipientIds.includes(f.id)}
                  onToggle={() => toggle(recipientIds, setRecipientIds, f.id)}
                />
              ))}
            </View>
          )
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={sharerIsMe ? handleShare : () => setMode('done')}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>
              {sharerIsMe
                ? recipientIds.length > 0
                  ? `Share with ${recipientIds.length} ${
                      recipientIds.length === 1 ? 'person' : 'people'
                    }`
                  : 'Skip for now'
                : 'Done'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderDone() {
    return (
      <View style={styles.doneContainer}>
        <Ionicons name="checkmark-circle" size={72} color="#4CAF50" />
        <Text style={styles.doneTitle}>All set!</Text>
        <Text style={styles.doneBody}>
          Your cast is saved{recipientIds.length > 0 ? ' and on its way to your people' : ''}.
        </Text>
        <TouchableOpacity style={styles.submitButton} onPress={resetState} activeOpacity={0.8}>
          <Text style={styles.submitText}>Record another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {mode === null && renderChoiceScreen()}
      {mode === 'recording' && renderRecordingScreen()}
      {mode === 'form' && renderForm()}
      {mode === 'recipients' && renderRecipients()}
      {mode === 'done' && renderDone()}
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
  helpText: {
    fontSize: 13,
    color: '#A89888',
    marginBottom: 8,
    marginLeft: 4,
    lineHeight: 19,
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

  // Person list (participants / recipients)
  personList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EFE8',
  },
  personAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F4A261',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  personAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D2D2D',
  },
  personEmail: {
    fontSize: 13,
    color: '#A89888',
    marginTop: 2,
  },

  // Chips (sharer picker)
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0E6DA',
  },
  chipActive: {
    backgroundColor: '#E8734A',
    borderColor: '#E8734A',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B5E50',
  },
  chipTextActive: {
    color: '#FFFFFF',
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

  // Done
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D2D2D',
    marginTop: 20,
    marginBottom: 10,
  },
  doneBody: {
    fontSize: 15,
    color: '#8C7B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
});
