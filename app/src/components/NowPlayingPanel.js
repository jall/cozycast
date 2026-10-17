import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CastCover from './CastCover';
import Glow from './Glow';
import Campfire from './Campfire';
import PlayerDeck from './PlayerDeck';
import { getComments, addComment } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';
import useReducedMotion from '../hooks/useReducedMotion';
import { coverFor } from '../utils/castCover';
import { formatClock } from '../utils/waveform';
import { friendTint, initialOf } from '../utils/people';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius, layout } from '../theme/space';

const native = Platform.OS !== 'web';

// Three little bars that dance while something plays — "by the fire now".
function Equalizer({ on }) {
  const reduced = useReducedMotion();
  const bars = [
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.8)).current,
    useRef(new Animated.Value(0.6)).current,
  ];
  useEffect(() => {
    if (!on || reduced) return undefined;
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: 300 + i * 90,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: native,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 300 + i * 90,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: native,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, reduced]);
  return (
    <View style={styles.eq}>
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.eqBar,
            { transformOrigin: '50% 100%', transform: [{ scaleY: on ? v : 0.35 }] },
          ]}
        />
      ))}
    </View>
  );
}

// The laptop's docked "by the fire" panel: whatever's playing, big — its
// cover glowing in its own colour, the full player deck, and the notes left
// along the way (tap a timestamp to jump there, or leave one at this moment).
// Shown from `layout.panelAt` up; below that the MiniPlayer does this job.
export default function NowPlayingPanel() {
  const { track, isPlaying, position, seek, loading } = usePlayer();
  const router = useRouter();
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [composing, setComposing] = useState(null); // ms the note is pinned to
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const trackId = track?.id;
  useEffect(() => {
    let live = true;
    setNotes([]);
    setComposing(null);
    if (trackId) {
      getComments(trackId)
        .then((cs) => live && setNotes(cs))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [trackId]);

  if (!track) {
    return (
      <View style={[styles.panel, styles.idle]}>
        <Campfire width={170} />
        <Text style={styles.idleTitle}>Nothing playing</Text>
        <Text style={styles.idleBody}>
          Pick a cast and sit with it a while. It’ll stay right here while you wander.
        </Text>
      </View>
    );
  }

  const glow = coverFor(track.seed, track.title).glow;

  async function postNote() {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      const note = await addComment(track.id, body, composing);
      setNotes((n) => [...n, note]);
      setDraft('');
      setComposing(null);
    } catch (err) {
      toast.error(err.message || 'Could not leave that note.');
    } finally {
      setPosting(false);
    }
  }

  const sorted = [...notes].sort(
    (a, b) => (a.at_ms ?? Number.MAX_SAFE_INTEGER) - (b.at_ms ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <View style={styles.panel}>
      <Glow color={glow} strength={0.35} style={styles.halo} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <Equalizer on={isPlaying} />
          <Text style={styles.status}>
            {loading ? 'Pulling up a log…' : isPlaying ? 'By the fire now' : 'Paused'}
          </Text>
          <TouchableOpacity
            onPress={() => router.push(`/cast/${track.id}`)}
            style={styles.open}
            accessibilityLabel="Open the full cast page"
          >
            <Ionicons name="expand-outline" size={18} color={colors.inkMuted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.coverWrap, { shadowColor: glow }]}>
          <CastCover seed={track.seed} title={track.title} size={260} radius={radius.lg} />
        </View>

        <Text style={styles.title}>{track.title}</Text>
        {track.artist ? <Text style={styles.artist}>{track.artist}</Text> : null}

        <PlayerDeck
          cast={track}
          notes={notes}
          onNote={(ms) => setComposing(ms)}
          compact
          style={styles.deck}
        />

        {composing != null ? (
          <View style={styles.composer}>
            <Text style={styles.composerLabel}>A note at {formatClock(composing)}</Text>
            <View style={styles.composerRow}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="What did this moment make you think?"
                placeholderTextColor={colors.inkFaint}
                autoFocus
                multiline
                onSubmitEditing={postNote}
              />
              <TouchableOpacity
                onPress={postNote}
                disabled={!draft.trim() || posting}
                style={[styles.send, (!draft.trim() || posting) && styles.sendOff]}
                accessibilityLabel="Post note"
              >
                {posting ? (
                  <ActivityIndicator size="small" color={colors.onEmber} />
                ) : (
                  <Ionicons name="arrow-up" size={18} color={colors.onEmber} />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setComposing(null)}>
              <Text style={styles.cancel}>Never mind</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.notes}>
          <View style={styles.notesHead}>
            <Text style={styles.notesTitle}>Along the way</Text>
            <Text style={styles.notesCount}>
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </Text>
          </View>
          {sorted.length === 0 ? (
            <Text style={styles.notesEmpty}>
              Nobody’s said anything yet. Leave the first note at {formatClock(position)}.
            </Text>
          ) : (
            sorted.map((n) => (
              <View key={n.id} style={styles.note}>
                <View style={[styles.noteFace, { backgroundColor: friendTint(n.author_name) }]}>
                  <Text style={styles.noteInitial}>{initialOf(n.author_name)}</Text>
                </View>
                <View style={styles.noteMain}>
                  <View style={styles.noteHead}>
                    <Text style={styles.noteName}>{n.author_name}</Text>
                    {n.at_ms != null ? (
                      <TouchableOpacity
                        onPress={() => seek(n.at_ms)}
                        style={styles.at}
                        accessibilityLabel={`Jump to ${formatClock(n.at_ms)}`}
                      >
                        <Text style={styles.atText}>at {formatClock(n.at_ms)}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={styles.noteBody}>{n.body}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: layout.panel,
    backgroundColor: colors.surfaceSunk,
    borderLeftWidth: 1,
    borderLeftColor: colors.hairline,
    overflow: 'hidden',
  },
  idle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['2xl'],
  },
  idleTitle: {
    ...type.h2,
    color: colors.ink,
    marginTop: space.xl,
  },
  idleBody: {
    ...type.bodySm,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: space.sm,
  },
  halo: {
    top: -20,
    left: -40,
    right: -40,
    height: 480,
  },
  scroll: {
    paddingHorizontal: space['2xl'],
    paddingTop: space['2xl'] - 4,
    paddingBottom: space['2xl'],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.xl,
  },
  status: {
    ...type.monoLabel,
    color: colors.emberSoft,
    marginLeft: space.sm + 2,
    flex: 1,
  },
  open: {
    padding: space.xs,
  },
  eq: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 14,
  },
  eqBar: {
    width: 3,
    height: 14,
    marginRight: 2,
    borderRadius: 1,
    backgroundColor: colors.emberSoft,
  },
  coverWrap: {
    alignSelf: 'center',
    borderRadius: radius.lg,
    shadowOpacity: 0.45,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 24 },
  },
  title: {
    ...type.h2,
    fontSize: 25,
    lineHeight: 30,
    color: colors.ink,
    textAlign: 'center',
    marginTop: space.xl,
  },
  artist: {
    ...type.bodySm,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: space.xs,
  },
  deck: {
    marginTop: space.lg,
  },
  composer: {
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  composerLabel: {
    ...type.monoLabel,
    color: colors.emberInk,
    marginBottom: space.sm,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    ...type.bodySm,
    color: colors.ink,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunk,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.sm,
  },
  sendOff: {
    opacity: 0.45,
  },
  cancel: {
    ...type.caption,
    color: colors.inkMuted,
    marginTop: space.sm,
  },
  notes: {
    marginTop: space.xl,
    paddingTop: space.lg + 2,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  notesHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  notesTitle: {
    fontFamily: type.moment.fontFamily,
    fontSize: 19,
    lineHeight: 24,
    color: colors.ink,
  },
  notesCount: {
    ...type.caption,
    fontSize: 13,
    color: colors.inkMuted,
  },
  notesEmpty: {
    ...type.bodySm,
    color: colors.inkMuted,
  },
  note: {
    flexDirection: 'row',
    marginBottom: space.md + 2,
  },
  noteFace: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm + 2,
  },
  noteInitial: {
    fontFamily: type.wordmark.fontFamily,
    fontSize: 12,
    color: colors.onEmber,
  },
  noteMain: {
    flex: 1,
  },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  noteName: {
    ...type.label,
    fontFamily: type.h3.fontFamily,
    fontSize: 14,
    color: colors.ink,
    marginRight: space.sm,
  },
  at: {
    backgroundColor: colors.accentSurface,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  atText: {
    ...type.time,
    fontSize: 12,
    lineHeight: 16,
    color: colors.emberInk,
  },
  noteBody: {
    ...type.bodySm,
    color: colors.inkSoft,
  },
});
