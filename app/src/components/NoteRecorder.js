import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import useMicLevel from '../hooks/useMicLevel';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';
import { beginCastUpload, sendVoiceNote } from '../api/client';
import { formatClock } from '../utils/waveform';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius, elevation } from '../theme/space';

// Record a voice note and send it: tap to start, tap the arrow to send (or ✕
// to throw it away). `reply` pins it to a moment in a cast: { castId, castTitle,
// atMs } — cleared with its ✕ via `onClearReply`.
export default function NoteRecorder({ toId, toName, castId, reply, onClearReply, onSent }) {
  const toast = useToast();
  const player = usePlayer();
  const [state, setState] = useState('idle'); // idle | recording | sending
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef(null);
  const timer = useRef(null);
  const mic = useMicLevel(state === 'recording');

  useEffect(
    () => () => {
      clearInterval(timer.current);
      recRef.current?.stopAndUnloadAsync().catch(() => {});
    },
    [],
  );

  async function start() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        toast.error('Please allow microphone access to record a voice note.');
        return;
      }
      await player.pause();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recRef.current = recording;
      setElapsed(0);
      setState('recording');
      timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      toast.error(err.message || 'Could not start recording.');
    }
  }

  async function finish(send) {
    clearInterval(timer.current);
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    setState(send ? 'sending' : 'idle');
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      if (!send) return;
      const upload = await beginCastUpload({ audioUri: rec.getURI() });
      const note = await sendVoiceNote({
        toId,
        castId: reply?.castId || castId || null,
        atMs: reply?.atMs ?? null,
        upload,
        duration: Math.max(1, elapsed),
      });
      onSent?.(note);
      onClearReply?.();
    } catch (err) {
      toast.error(err.message || 'Could not send your voice note.');
    } finally {
      setState('idle');
    }
  }

  const bars = Array.from(
    { length: mic.slots },
    (_, i) => mic.history[i - (mic.slots - mic.history.length)] ?? 0,
  );

  return (
    <View style={styles.wrap}>
      {reply?.atMs != null ? (
        <View style={styles.reply}>
          <Ionicons name="return-down-forward" size={13} color={colors.emberSoft} />
          <Text style={styles.replyText} numberOfLines={1}>
            Replying at {formatClock(reply.atMs)}
            {reply.castTitle ? ` in ${reply.castTitle}` : ''}
          </Text>
          <TouchableOpacity
            onPress={onClearReply}
            accessibilityLabel="Not replying to a moment"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={14} color={colors.inkMuted} />
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.row}>
        {state === 'recording' ? (
          <>
            <TouchableOpacity
              onPress={() => finish(false)}
              style={styles.cancel}
              accessibilityLabel="Throw it away"
              testID="note-cancel"
            >
              <Ionicons name="close" size={20} color={colors.ink} />
            </TouchableOpacity>
            <Text style={styles.elapsed}>{formatClock(elapsed * 1000)}</Text>
            <View style={styles.live} accessibilityElementsHidden>
              {bars.map((v, i) => (
                <View
                  key={i}
                  style={[styles.liveBar, { height: Math.max(3, Math.round(v * 30)) }]}
                />
              ))}
            </View>
            <TouchableOpacity
              onPress={() => finish(true)}
              style={styles.send}
              accessibilityLabel={`Send to ${toName}`}
              testID="note-send"
            >
              <Ionicons name="arrow-up" size={24} color={colors.onEmber} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              {state === 'sending'
                ? 'Sending…'
                : `Tap the mic to leave ${toName} a voice note — tap the arrow to send.`}
            </Text>
            <TouchableOpacity
              onPress={start}
              disabled={state === 'sending'}
              style={styles.mic}
              accessibilityLabel={`Record a voice note for ${toName}`}
              testID="note-record"
            >
              {state === 'sending' ? (
                <ActivityIndicator color={colors.onEmber} />
              ) : (
                <Ionicons name="mic" size={26} color={colors.onEmber} />
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    backgroundColor: colors.bg,
  },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    marginBottom: space.sm,
    maxWidth: '100%',
  },
  replyText: {
    ...type.time,
    fontSize: 12,
    color: colors.emberSoft,
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  hint: {
    ...type.bodySm,
    color: colors.inkMuted,
    flex: 1,
  },
  mic: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.glow,
  },
  cancel: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.smoke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elapsed: {
    ...type.time,
    color: colors.ink,
    width: 44,
  },
  live: {
    flex: 1,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveBar: {
    flex: 1,
    marginHorizontal: 1,
    borderRadius: 2,
    backgroundColor: colors.emberSoft,
  },
  send: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.glow,
  },
});
