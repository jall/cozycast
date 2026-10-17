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
import {
  createCast,
  shareCast,
  getFriends,
  beginCastUpload,
  discardUpload,
  answerCastRequest,
} from '../api/client';
import { useRouter } from 'expo-router';
import PressableScale from '../components/PressableScale';
import Campfire from '../components/Campfire';
import Avatar from '../components/Avatar';
import useMicLevel from '../hooks/useMicLevel';
import { useShell } from '../context/ShellContext';
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
function PersonRow({ person, selected, onToggle, testID }) {
  return (
    <TouchableOpacity
      style={styles.personRow}
      onPress={onToggle}
      activeOpacity={0.7}
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
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
  // null | 'recording' | 'form' | 'done'
  const [mode, setMode] = useState(null);
  const [recording, setRecording] = useState(null);
  const [recordingUri, setRecordingUri] = useState(null);
  const [audioMime, setAudioMime] = useState(null);
  const [pickedDuration, setPickedDuration] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [friends, setFriends] = useState([]);
  // Arrived via "Record with <name>"? They're pre-tagged as being in it.
  const { recordWith, setRecordWith, answering, setAnswering } = useShell();
  const router = useRouter();
  // The upload starts the moment there's audio (see startUpload), so saving is
  // usually instant by the time the title's written.
  const uploadRef = useRef(null);
  const [uploadState, setUploadState] = useState(null); // null | 'uploading' | 'done' | 'failed'
  const [participantIds, setParticipantIds] = useState(() => (recordWith ? [recordWith.id] : []));
  useEffect(() => {
    if (!recordWith) return;
    setParticipantIds((ids) => (ids.includes(recordWith.id) ? ids : [...ids, recordWith.id]));
  }, [recordWith]);
  const [sharerId, setSharerId] = useState('me');
  // Answering someone's "ask for a cast"? It goes to them.
  const [recipientIds, setRecipientIds] = useState(() => (answering ? [answering.from.id] : []));
  useEffect(() => {
    if (!answering) return;
    setRecipientIds((ids) => (ids.includes(answering.from.id) ? ids : [...ids, answering.from.id]));
  }, [answering]);

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createdCast, setCreatedCast] = useState(null);
  const [sentCount, setSentCount] = useState(0);
  const sharerIsMe = sharerId === 'me' || sharerId === user?.id;
  // A gentle conversation prompt, picked once per visit to this screen.
  const [tip, setTip] = useState(randomTip);

  const timerRef = useRef(null);
  const pulse = useRef(new Animated.Value(0)).current;

  // Crossfade, never cut: each step of the flow breathes in over ~280ms.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [mode, fade]);

  // Your voice, live: drives the fire's height and the rolling waveform.
  const mic = useMicLevel(mode === 'recording');

  useEffect(() => {
    getFriends()
      .then(setFriends)
      .catch(() => setFriends([]));
  }, []);

  // Gentle "breathing" halo behind the record button (waiting) and the stop
  // button (recording).
  useEffect(() => {
    if (mode !== 'recording' && mode !== null) return undefined;
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
      startUpload(uri, null);
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
      startUpload(asset.uri, asset.mimeType || null);
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

  // Kick off the upload (and waveform) in the background as soon as there's
  // audio, so it's done — or nearly — by the time they press Keep.
  function startUpload(uri, mime) {
    setUploadProgress(0);
    setUploadState('uploading');
    const pending = beginCastUpload({
      audioUri: uri,
      mimeType: mime,
      onProgress: setUploadProgress,
    });
    uploadRef.current = pending;
    pending
      .then((up) => up.uploaded)
      .then(() => uploadRef.current === pending && setUploadState('done'))
      .catch(() => uploadRef.current === pending && setUploadState('failed'));
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
    try {
      // A failed background upload gets one fresh try now.
      if (uploadState === 'failed') startUpload(recordingUri, audioMime);
      const upload = await uploadRef.current;

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
        upload,
      });
      uploadRef.current = null;
      setCreatedCast(cast);

      // You're the sharer: send it to the people you picked (anyone tagged can
      // already hear it, so they're not double-counted).
      const sendTo = sharerIsMe ? recipientIds.filter((id) => !participantIds.includes(id)) : [];
      if (sendTo.length > 0) {
        try {
          await shareCast(cast.id, sendTo);
        } catch (err) {
          toast.error(
            err.message || 'Your cast was saved, but sharing failed — try from its page.',
          );
        }
      }
      if (answering) {
        await answerCastRequest(answering.id, cast.id).catch(() => {});
        setAnswering(null);
      }
      setSentCount(sendTo.length);
      setMode('done');
    } catch (err) {
      toast.error(err.message || 'Could not create your cast.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetState() {
    // Cancelled before keeping it: don't leave the upload lying around.
    if (uploadRef.current) {
      uploadRef.current.then(discardUpload).catch(() => {});
      uploadRef.current = null;
    }
    setUploadState(null);
    setRecordWith(null);
    setAnswering(null);
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
    setSentCount(0);
  }

  function renderChoiceScreen() {
    return (
      <ScrollView contentContainerStyle={styles.choiceContainer}>
        <Text style={styles.screenTitle}>Start a cast</Text>
        <Text style={styles.screenSubtitle}>say something, then choose who hears it</Text>

        {answering ? (
          <View style={styles.answerBanner} testID="answering">
            <Ionicons name="return-down-forward" size={16} color={colors.emberInk} />
            <Text style={styles.answerText}>
              {answering.from.name} asked: “{answering.prompt}” — it’ll go to them when you keep it.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setAnswering(null);
                setRecipientIds((ids) => ids.filter((x) => x !== answering.from.id));
              }}
              accessibilityLabel="Not answering this ask"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {recordWith ? (
          <View style={styles.withRow}>
            <Avatar name={recordWith.name} path={recordWith.avatar_path} size={24} />
            <Text style={styles.withText}>With {recordWith.name} — they’ll be tagged in it</Text>
            <TouchableOpacity
              onPress={() => {
                setRecordWith(null);
                setParticipantIds((ids) => ids.filter((x) => x !== recordWith.id));
              }}
              accessibilityLabel={`Don't tag ${recordWith.name}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.hearth}>
          <Campfire width={190} sparks={false} style={styles.hearthFire} />
          <View style={styles.recordWrap}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.recordHalo,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
                  transform: [
                    { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
                  ],
                },
              ]}
            />
            <PressableScale
              testID="record-start"
              style={styles.recordButton}
              onPress={startRecording}
              accessibilityLabel="Start recording"
            >
              <Ionicons name="mic" size={46} color={colors.onEmber} />
            </PressableScale>
          </View>
          <Text style={styles.recordCue}>Tap and start talking</Text>
          <TouchableOpacity
            testID="record-pick"
            onPress={handlePickFile}
            style={styles.pickLink}
            activeOpacity={0.7}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.emberInk} />
            <Text style={styles.pickText}>or bring an audio file you already have</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipCard} testID="conversation-tip">
          <View style={styles.tipHeader}>
            <Ionicons name="chatbubbles-outline" size={15} color={colors.emberSoft} />
            <Text style={styles.tipLabel}>Recording with someone? Try this:</Text>
            <TouchableOpacity
              onPress={() => setTip((t) => randomTip(t))}
              style={styles.tipShuffle}
              accessibilityLabel="Another tip"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="shuffle" size={16} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.tipText}>{tip}</Text>
        </View>

        <View style={styles.privacyRow}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.inkMuted} />
          <Text style={styles.privacyText}>Nothing is shared until you choose who hears it.</Text>
        </View>
      </ScrollView>
    );
  }

  function renderRecordingScreen() {
    const bars = Array.from(
      { length: mic.slots },
      (_, i) => mic.history[i - (mic.slots - mic.history.length)] ?? 0,
    );
    return (
      <View style={styles.recordingContainer}>
        <View style={styles.recordingPill}>
          <Animated.View
            style={[
              styles.recDot,
              { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
            ]}
          />
          <Text style={styles.recordingLabel}>recording</Text>
        </View>
        <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
        <Text style={styles.recordingMoment}>Take your time. The fire’s listening.</Text>

        {/* The fire rises and settles with your voice. */}
        <Campfire width={240} intensity={mic.level} style={styles.recordingFire} />

        <View style={styles.liveWave} accessibilityElementsHidden>
          {bars.map((v, i) => (
            <View
              key={i}
              style={[
                styles.liveBar,
                {
                  height: Math.max(3, Math.round(v * 44)),
                  backgroundColor: i >= bars.length - 10 ? colors.emberSoft : colors.smoke,
                },
              ]}
            />
          ))}
        </View>

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
            accessibilityLabel="Stop"
          >
            <View style={styles.stopSquare} />
          </TouchableOpacity>
        </View>

        <Text style={styles.recordingHint}>Tap to stop</Text>
        <View style={styles.privacyRow}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.inkMuted} />
          <Text style={styles.privacyText}>Nobody hears this until you choose who.</Text>
        </View>
      </View>
    );
  }

  function chip(person, on, onPress, testID) {
    return (
      <TouchableOpacity
        key={person.id}
        style={[styles.chip, on && styles.chipActive]}
        onPress={onPress}
        activeOpacity={0.8}
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
      >
        <Text style={[styles.chipText, on && styles.chipTextActive]}>{person.name}</Text>
      </TouchableOpacity>
    );
  }

  function renderUploadStatus() {
    if (!uploadState) return null;
    const pct = Math.round(uploadProgress * 100);
    return (
      <View style={styles.audioPreviewRow}>
        <Ionicons
          name={
            uploadState === 'done'
              ? 'checkmark-circle'
              : uploadState === 'failed'
                ? 'alert-circle'
                : 'cloud-upload-outline'
          }
          size={22}
          color={uploadState === 'failed' ? colors.danger : colors.success}
        />
        <View style={styles.uploadInfo}>
          <Text style={styles.audioPreviewText}>
            Got it — sounds good
            {elapsed || pickedDuration ? ` (${formatElapsed(elapsed || pickedDuration)})` : ''}
          </Text>
          <Text style={styles.uploadNote}>
            {uploadState === 'done'
              ? 'Safely uploaded — only you can hear it until you choose.'
              : uploadState === 'failed'
                ? 'Upload hiccuped — we’ll try again when you keep it.'
                : `Uploading in the background… ${pct}%`}
          </Text>
          {uploadState === 'uploading' ? (
            <View style={styles.uploadTrack}>
              <View style={[styles.uploadFill, { width: `${pct}%` }]} />
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  function renderForm() {
    const tagged = friends.filter((f) => participantIds.includes(f.id));
    const others = friends.filter((f) => !participantIds.includes(f.id));
    const sharer = tagged.find((f) => f.id === sharerId);
    const sendCount = sharerIsMe
      ? recipientIds.filter((id) => !participantIds.includes(id)).length
      : 0;
    return (
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>A few words</Text>
        <Text style={styles.screenSubtitle}>what was this conversation?</Text>

        {answering ? (
          <View style={styles.answerBanner}>
            <Ionicons name="return-down-forward" size={16} color={colors.emberInk} />
            <Text style={styles.answerText}>
              Answering {answering.from.name}: “{answering.prompt}”
            </Text>
          </View>
        ) : null}

        {renderUploadStatus()}

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

        {friends.length === 0 ? (
          <Text style={styles.helpText}>
            Invite someone from your You tab, and you’ll be able to tag them and share casts with
            them. For now this stays just yours.
          </Text>
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Who’s in it?</Text>
              <Text style={styles.helpText}>Tag who’s talking. Anyone tagged can hear it too.</Text>
              <View style={styles.chipRow}>
                {friends.map((f) =>
                  chip(
                    f,
                    participantIds.includes(f.id),
                    () => toggleParticipant(f.id),
                    'tag-person',
                  ),
                )}
              </View>
            </View>

            {tagged.length > 0 ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Who decides who else hears it?</Text>
                <View style={styles.chipRow}>
                  {chip(
                    { id: 'me', name: 'You' },
                    sharerIsMe,
                    () => setSharerId('me'),
                    'sharer-me',
                  )}
                  {tagged.map((f) =>
                    chip(f, sharerId === f.id, () => setSharerId(f.id), 'sharer-person'),
                  )}
                </View>
              </View>
            ) : null}

            {sharerIsMe ? (
              others.length > 0 ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Who else hears it?</Text>
                  <Text style={styles.helpText}>
                    Only the people you pick — no one else, ever. You can change this later.
                  </Text>
                  <View style={styles.personList}>
                    {others.map((f) => (
                      <PersonRow
                        key={f.id}
                        person={f}
                        selected={recipientIds.includes(f.id)}
                        onToggle={() => toggle(recipientIds, setRecipientIds, f.id)}
                        testID="hear-person"
                      />
                    ))}
                  </View>
                </View>
              ) : null
            ) : (
              <Text style={styles.helpText}>
                {sharer?.name || 'They'} will choose who else hears it — we’ll let them know.
              </Text>
            )}
          </>
        )}

        <PressableScale
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleCreate}
          disabled={submitting}
          testID="keep-cast"
        >
          {submitting ? (
            <ActivityIndicator color={colors.onEmber} />
          ) : (
            <Text style={styles.submitText}>
              {sendCount > 0
                ? `Keep it & share with ${sendCount} ${sendCount === 1 ? 'person' : 'people'}`
                : 'Keep it'}
            </Text>
          )}
        </PressableScale>

        <TouchableOpacity style={styles.cancelButton} onPress={resetState} activeOpacity={0.6}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderDone() {
    return (
      <View style={styles.doneContainer}>
        <Campfire width={170} />
        <Text style={styles.doneTitle}>It’s kept.</Text>
        <Text style={styles.doneBody}>
          {sentCount > 0
            ? `Your cast is safe, and on its way to the ${sentCount === 1 ? 'person' : `${sentCount} people`} you chose.`
            : sharerIsMe
              ? 'Your cast is safe — share it whenever you’re ready.'
              : 'Your cast is safe — they’ll choose who else hears it.'}
        </Text>
        <View style={styles.doneActions}>
          {createdCast ? (
            <TouchableOpacity
              style={styles.doneSecondary}
              onPress={() => router.push(`/cast/${createdCast.id}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.doneSecondaryText}>Open it</Text>
            </TouchableOpacity>
          ) : null}
          <PressableScale style={styles.donePrimary} onPress={resetState}>
            <Ionicons name="mic" size={18} color={colors.onEmber} />
            <Text style={styles.donePrimaryText}>Record another</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.column, { opacity: fade }]}>
        {mode === null && renderChoiceScreen()}
        {mode === 'recording' && renderRecordingScreen()}
        {mode === 'form' && renderForm()}
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
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
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
    flex: 1,
  },
  tipShuffle: {
    padding: 2,
  },
  tipText: {
    fontFamily: type.moment.fontFamily,
    fontSize: 19,
    lineHeight: 26,
    color: colors.ink,
  },

  // Recording screen
  recordingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  recordingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSurface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    marginBottom: space.lg,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5A3D',
    marginRight: space.sm,
  },
  recordingLabel: {
    ...type.monoLabel,
    fontSize: 12,
    color: colors.emberInk,
  },
  elapsed: {
    ...type.numeric,
    color: colors.ink,
  },
  recordingMoment: {
    fontFamily: type.moment.fontFamily,
    fontSize: 18,
    lineHeight: 24,
    color: colors.inkSoft,
    marginTop: space.xs,
  },
  recordingFire: {
    marginTop: space.xl,
    marginBottom: space.md,
  },
  liveWave: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    width: '100%',
    maxWidth: 360,
    marginBottom: space.xl,
  },
  liveBar: {
    flex: 1,
    marginHorizontal: 1.5,
    borderRadius: 2,
  },
  withRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSurface,
    borderRadius: radius.pill,
    paddingLeft: 4,
    paddingRight: space.md,
    paddingVertical: 4,
    marginTop: -space.lg,
    marginBottom: space.lg,
  },
  withText: {
    ...type.label,
    color: colors.ink,
    marginHorizontal: space.sm,
  },
  hearth: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    marginBottom: space.lg,
    overflow: 'hidden',
  },
  hearthFire: {
    marginBottom: space.sm,
  },
  recordWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordHalo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 80, 0.55)',
    backgroundColor: 'rgba(255, 122, 61, 0.10)',
  },
  recordButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.glow,
  },
  recordCue: {
    fontFamily: type.moment.fontFamily,
    fontSize: 20,
    lineHeight: 26,
    color: colors.ink,
    marginTop: space.sm,
  },
  pickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
    paddingVertical: space.xs,
  },
  pickText: {
    ...type.label,
    color: colors.emberInk,
    marginLeft: 6,
  },
  pulseWrap: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  halo: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 80, 0.5)',
    // The one place ember appears as a wash: the breathing halo while you record.
    backgroundColor: 'rgba(255, 122, 61, 0.12)',
  },
  stopButton: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FF5A3D',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
  },
  privacyText: {
    ...type.caption,
    fontSize: 13,
    color: colors.inkMuted,
    marginLeft: 6,
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
    backgroundColor: colors.surface,
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
    color: colors.onEmber,
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

  uploadInfo: {
    flex: 1,
    marginLeft: space.sm + 2,
  },
  uploadNote: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 2,
  },
  answerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accentSurface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#6B3A28',
    padding: space.md,
    marginBottom: space.lg,
  },
  answerText: {
    ...type.bodySm,
    color: colors.ink,
    flex: 1,
    marginLeft: space.sm,
  },
  doneActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  donePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md + 2,
    margin: space.xs,
    ...elevation.glow,
  },
  donePrimaryText: {
    ...type.h3,
    color: colors.onEmber,
    marginLeft: space.sm,
  },
  doneSecondary: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.smoke,
    paddingHorizontal: space.xl,
    paddingVertical: space.md + 2,
    margin: space.xs,
  },
  doneSecondaryText: {
    ...type.h3,
    color: colors.ink,
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
