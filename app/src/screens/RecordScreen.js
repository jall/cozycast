import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { createCast, shareCast, getFriends } from '../api/client';
import PressableScale from '../components/PressableScale';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fonts } from '../theme/typography';
import { type } from '../theme/type';
import { space, radius, elevation, layout } from '../theme/space';
import { randomTip } from '../constants/tips';

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function initial(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

// Read an audio file's duration (seconds) from its metadata so the cast stores
// it up front — otherwise the feed shows 0:00 until the listener hits play.
// Web reads it off an <audio> element; native loads metadata via expo-av.
// Resolves null when unavailable.
async function getAudioDurationSeconds(uri) {
  try {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return null;
      return await new Promise((resolve) => {
        const el = document.createElement('audio');
        el.preload = 'metadata';
        el.onloadedmetadata = () =>
          resolve(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration) : null);
        el.onerror = () => resolve(null);
        el.src = uri;
      });
    }

    const { sound, status } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
    const dur =
      status?.isLoaded && status.durationMillis ? Math.round(status.durationMillis / 1000) : null;
    await sound.unloadAsync();
    return dur;
  } catch {
    return null;
  }
}

// Accept audio only for now (the bucket rejects video, and we don't yet extract
// audio from video). Trust the picked mime type, falling back to the extension.
function isAudioFile(mime, name) {
  if (mime && mime.startsWith('audio/')) return true;
  if (mime && mime.startsWith('video/')) return false;
  return /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|webm)$/i.test(name || '');
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
        color={selected ? colors.ember : colors.inkFaint}
      />
    </TouchableOpacity>
  );
}

export default function RecordScreen() {
  const { user } = useAuth();
  const toast = useToast();
  // null | 'recording' | 'form' | 'recipients' | 'done'
  const [mode, setMode] = useState(null);
  const [recording, setRecording] = useState(null);
  const [recordingUri, setRecordingUri] = useState(null);
  const [audioMime, setAudioMime] = useState(null);
  const [pickedDuration, setPickedDuration] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [friends, setFriends] = useState([]);
  const [participantIds, setParticipantIds] = useState([]);
  const [sharerId, setSharerId] = useState('me');
  const [recipientIds, setRecipientIds] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createdCast, setCreatedCast] = useState(null);
  // A gentle conversation prompt, picked once per visit to this screen.
  const [tip] = useState(randomTip);

  const timerRef = useRef(null);
  const pulse = useRef(new Animated.Value(0)).current;

  // Crossfade, never cut: each step of the flow breathes in over ~280ms.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [mode, fade]);

  useEffect(() => {
    getFriends()
      .then(setFriends)
      .catch(() => setFriends([]));
  }, []);

  // Gentle "breathing" halo behind the stop button while recording.
  useEffect(() => {
    if (mode !== 'recording') return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mode, pulse]);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        toast.error('Please allow microphone access to record audio.');
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
      toast.error(err.message || 'Could not start recording.');
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
      toast.error(err.message || 'Could not stop recording.');
      setMode(null);
    }
  }

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!isAudioFile(asset.mimeType, asset.name)) {
        toast.error(
          'cozycast supports audio files for now — please pick an audio file, not a video.',
        );
        return;
      }

      setRecordingUri(asset.uri);
      setAudioMime(asset.mimeType || null);
      setElapsed(0);
      setPickedDuration(await getAudioDurationSeconds(asset.uri));
      setMode('form');
    } catch {
      toast.error('Could not pick that file.');
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
      toast.error('Give your cast a title first.');
      return;
    }
    if (!recordingUri) {
      toast.error('Please record or pick some audio first.');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    try {
      const participants = friends
        .filter((f) => participantIds.includes(f.id))
        .map((f) => ({ id: f.id, name: f.name }));

      const cast = await createCast({
        title: title.trim(),
        summary: summary.trim() || null,
        audioUri: recordingUri,
        duration: elapsed || pickedDuration || null,
        mimeType: audioMime,
        participants,
        sharerId: sharerId === 'me' ? user?.id : sharerId,
        onProgress: setUploadProgress,
      });

      setCreatedCast(cast);
      setMode('recipients');
    } catch (err) {
      toast.error(err.message || 'Could not create your cast.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    setSubmitting(true);
    try {
      await shareCast(createdCast.id, recipientIds);
      if (recipientIds.length > 0) {
        const who = recipientIds.length === 1 ? 'one person' : `${recipientIds.length} people`;
        toast.success(`Sent to ${who} 🌿`);
      }
      setMode('done');
    } catch (err) {
      toast.error(err.message || 'Your cast was saved, but sharing failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetState() {
    setMode(null);
    setRecordingUri(null);
    setAudioMime(null);
    setPickedDuration(null);
    setUploadProgress(0);
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
        <Text style={styles.screenTitle}>Start a cast</Text>
        <Text style={styles.screenSubtitle}>say something, then choose who hears it</Text>

        <PressableScale
          testID="record-start"
          style={styles.choiceCard}
          hoverStyle={styles.choiceCardHover}
          onPress={startRecording}
        >
          <View style={styles.choiceIconWrap}>
            <Ionicons name="mic" size={32} color={colors.ember} />
          </View>
          <View style={styles.choiceTextWrap}>
            <Text style={styles.choiceTitle}>Record</Text>
            <Text style={styles.choiceDesc}>Record something right now</Text>
          </View>
        </PressableScale>

        <PressableScale
          testID="record-pick"
          style={styles.choiceCard}
          hoverStyle={styles.choiceCardHover}
          onPress={handlePickFile}
        >
          <View style={styles.choiceIconWrap}>
            <Ionicons name="document-outline" size={32} color={colors.emberSoft} />
          </View>
          <View style={styles.choiceTextWrap}>
            <Text style={styles.choiceTitle}>Pick a file</Text>
            <Text style={styles.choiceDesc}>Bring a conversation you already have</Text>
          </View>
        </PressableScale>

        <View style={styles.tipCard} testID="conversation-tip">
          <View style={styles.tipHeader}>
            <Ionicons name="sparkles-outline" size={15} color={colors.ember} />
            <Text style={styles.tipLabel}>a tiny game</Text>
          </View>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      </View>
    );
  }

  function renderRecordingScreen() {
    return (
      <View style={styles.recordingContainer}>
        <Text style={styles.recordingLabel}>recording</Text>
        <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>

        <View style={styles.pulseWrap}>
          {/* The breathing halo sits *behind* the button and never intercepts
              touches, so the button itself stays static and tappable. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                transform: [
                  { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) },
                ],
              },
            ]}
          />
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
        <Text style={styles.screenTitle}>A few words</Text>
        <Text style={styles.screenSubtitle}>what was this conversation?</Text>

        <View style={styles.audioPreviewRow}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.audioPreviewText}>
            Got it — sounds good
            {elapsed || pickedDuration ? ` (${formatElapsed(elapsed || pickedDuration)})` : ''}
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What's this about?"
            placeholderTextColor={colors.inkFaint}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Summary (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={summary}
            onChangeText={setSummary}
            placeholder="A little about the conversation..."
            placeholderTextColor={colors.inkFaint}
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

        {submitting && uploadProgress > 0 ? (
          <View style={styles.uploadProgressWrap}>
            <View style={styles.uploadTrack}>
              <View
                style={[styles.uploadFill, { width: `${Math.round(uploadProgress * 100)}%` }]}
              />
            </View>
            <Text style={styles.uploadPct}>
              {uploadProgress >= 1
                ? 'Finishing up…'
                : `Uploading ${Math.round(uploadProgress * 100)}%`}
            </Text>
          </View>
        ) : null}

        <PressableScale
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleCreate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onEmber} />
          ) : (
            <Text style={styles.submitText}>Choose who hears it</Text>
          )}
        </PressableScale>

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
        <Text style={styles.screenTitle}>Who’s this for?</Text>
        <Text style={styles.screenSubtitle}>
          {sharerIsMe
            ? 'choose the people who get to hear it. no one else, ever.'
            : "you asked someone else to share this — they'll choose who hears it."}
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

        <PressableScale
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={sharerIsMe ? handleShare : () => setMode('done')}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onEmber} />
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
        </PressableScale>
      </ScrollView>
    );
  }

  function renderDone() {
    return (
      <View style={styles.doneContainer}>
        <Ionicons name="checkmark-circle" size={72} color={colors.success} />
        <Text style={styles.doneTitle}>It’s kept.</Text>
        <Text style={styles.doneBody}>
          {recipientIds.length > 0
            ? 'Your cast is safe, and on its way to the people you chose.'
            : 'Your cast is safe — share it whenever you’re ready.'}
        </Text>
        <PressableScale style={styles.submitButton} onPress={resetState}>
          <Text style={styles.submitText}>Record another</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.column, { opacity: fade }]}>
        {mode === null && renderChoiceScreen()}
        {mode === 'recording' && renderRecordingScreen()}
        {mode === 'form' && renderForm()}
        {mode === 'recipients' && renderRecipients()}
        {mode === 'done' && renderDone()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
  },

  // Choice screen
  choiceContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  screenTitle: {
    ...type.h1,
    color: colors.ink,
    marginBottom: space.sm,
  },
  screenSubtitle: {
    ...type.bodySm,
    fontSize: 15,
    color: colors.inkMuted,
    marginBottom: space['2xl'],
  },
  choiceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.lg,
    ...elevation.rest,
  },
  choiceCardHover: {
    ...elevation.raised,
  },
  choiceIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.lg + 2,
  },
  choiceTextWrap: {
    flex: 1,
  },
  choiceTitle: {
    ...type.h3,
    fontSize: 17,
    color: colors.ink,
    marginBottom: space.xs,
  },
  choiceDesc: {
    ...type.bodySm,
    color: colors.inkMuted,
  },

  // Conversation prompt ("a tiny game")
  tipCard: {
    backgroundColor: colors.accentSurface,
    borderRadius: radius.md,
    padding: space.lg + 2,
    marginTop: space.md,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  tipLabel: {
    ...type.eyebrow,
    color: colors.emberInk,
    marginLeft: space.xs + 2,
  },
  tipText: {
    ...type.bodySm,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.medium,
    color: colors.inkSoft,
  },

  // Recording screen
  recordingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  recordingLabel: {
    ...type.eyebrow,
    fontSize: 14,
    lineHeight: 18,
    color: colors.emberInk,
    letterSpacing: 1,
    marginBottom: space.md,
  },
  elapsed: {
    ...type.numeric,
    color: colors.ink,
    marginBottom: space['3xl'],
  },
  pulseWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  halo: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    // The one place ember appears as a wash: the breathing halo while you record.
    backgroundColor: 'rgba(224, 104, 62, 0.14)',
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.raised,
  },
  stopSquare: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  recordingHint: {
    ...type.bodySm,
    color: colors.inkMuted,
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
    backgroundColor: colors.successSurface,
    borderRadius: radius.sm,
    padding: space.md + 2,
    marginBottom: space.xl + 4,
  },
  audioPreviewText: {
    ...type.label,
    fontSize: 14,
    color: colors.success,
    marginLeft: space.sm + 2,
  },
  uploadProgressWrap: {
    marginTop: 12,
  },
  uploadTrack: {
    height: 8,
    backgroundColor: colors.hairline,
    borderRadius: 4,
    overflow: 'hidden',
  },
  uploadFill: {
    height: 8,
    backgroundColor: colors.ember,
    borderRadius: 4,
  },
  uploadPct: {
    ...type.caption,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
    marginTop: space.xs + 2,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    ...type.label,
    color: colors.inkSoft,
    marginBottom: space.xs + 2,
    marginLeft: space.xs,
  },
  helpText: {
    ...type.bodySm,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMuted,
    marginBottom: space.sm,
    marginLeft: space.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },

  // Person list (participants / recipients)
  personList: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  personAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.emberSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  personAvatarText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    ...type.label,
    fontSize: 15,
    color: colors.ink,
  },
  personEmail: {
    ...type.caption,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 2,
  },

  // Chips (sharer picker)
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    marginRight: space.sm,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipActive: {
    backgroundColor: colors.ember,
    borderColor: colors.ember,
  },
  chipText: {
    ...type.label,
    fontSize: 14,
    color: colors.inkSoft,
  },
  chipTextActive: {
    color: colors.onEmber,
  },

  submitButton: {
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
    marginTop: space.md,
    ...elevation.raised,
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    ...type.h3,
    fontSize: 17,
    color: colors.onEmber,
  },
  cancelButton: {
    marginTop: space.lg + 2,
    alignItems: 'center',
    paddingVertical: space.md,
  },
  cancelText: {
    ...type.label,
    fontSize: 15,
    color: colors.inkMuted,
  },

  // Done
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  doneTitle: {
    ...type.h1,
    color: colors.ink,
    marginTop: space.lg + 4,
    marginBottom: space.sm + 2,
  },
  doneBody: {
    ...type.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: space['2xl'],
  },
});
