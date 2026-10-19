import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Avatar from '../components/Avatar';
import Waveform from '../components/Waveform';
import NoteRecorder from '../components/NoteRecorder';
import useLayout from '../hooks/useLayout';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { useNotifications } from '../context/NotificationsContext';
import { useToast } from '../context/ToastContext';
import {
  getVoiceNotes,
  getFriends,
  getNoteTranscripts,
  requestNoteTranscript,
  markNotesHeard,
  markAllNotesHeard,
  unsendVoiceNote,
} from '../api/client';
import { conversations, filterConversations, conversationState, CHAT } from '../utils/notes';
import { formatClock } from '../utils/waveform';
import { timeAgo } from '../utils/time';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius } from '../theme/space';

// Notes we've asked to be transcribed this session (so a failure isn't
// retried on every visit).
const transcriptAsked = new Set();

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unheard', label: 'Unheard' },
  { key: 'waiting', label: 'Waiting on you' },
];

// Voice notes: a conversation per person, threads within it (just chat, or
// about a cast you can both hear), bubbles you tap to hear, each with what was
// said underneath. On a laptop, the list and the open conversation sit side
// by side; on a phone, they're two screens. `personId` is the open one.
export default function VoiceNotesScreen({ personId }) {
  const { user } = useAuth();
  const uid = user?.id;
  const router = useRouter();
  const params = useLocalSearchParams();
  const toast = useToast();
  const player = usePlayer();
  const { setUnheardNotes } = useNotifications();
  const { content } = useLayout();
  const twoPane = content >= 860;

  const [notes, setNotes] = useState([]);
  const [friends, setFriends] = useState([]);
  const [texts, setTexts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  // Arrived from a cast ("Voice note to Ben"): open that thread, maybe at a moment.
  const linkedCast = typeof params.cast === 'string' ? params.cast : null;
  const [threadKey, setThreadKey] = useState(linkedCast);
  const [reply, setReply] = useState(() =>
    linkedCast && params.at != null && params.at !== ''
      ? {
          castId: linkedCast,
          castTitle: typeof params.title === 'string' ? params.title : null,
          atMs: Number(params.at),
        }
      : null,
  );
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    const [ns, fs] = await Promise.all([getVoiceNotes(), getFriends().catch(() => [])]);
    setNotes(ns);
    setFriends(fs || []);
    setUnheardNotes(ns.filter((n) => n.to_id === uid && !n.heard_at).length);
    const ts = await getNoteTranscripts(ns.map((n) => n.id));
    setTexts(ts);
    // Ask for any missing ones (a few at a time), and fill them in as they come.
    ns.filter((n) => !(n.id in ts) && !transcriptAsked.has(n.id))
      .slice(-6)
      .forEach((n) => {
        transcriptAsked.add(n.id);
        requestNoteTranscript(n.id)
          .then((text) => text != null && setTexts((t) => ({ ...t, [n.id]: text })))
          .catch(() => {});
      });
  }, [uid, setUnheardNotes]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  // A different person: start on their newest thread (unless a cast was linked).
  useEffect(() => {
    setThreadKey(linkedCast);
  }, [personId, linkedCast]);

  const list = conversations(notes, uid);
  const shown = filterConversations(list, filter);
  const counts = {
    unheard: filterConversations(list, 'unheard').length,
    waiting: filterConversations(list, 'waiting').length,
  };
  const person = (id) => friends.find((f) => f.id === id) || { id, name: 'Someone' };
  const firstName = (id) => (person(id).name || '').split(/\s+/)[0] || 'them';
  const current = personId ? list.find((c) => c.personId === personId) || null : null;
  const unstarted = friends.filter((f) => !list.some((c) => c.personId === f.id));

  function open(id) {
    if (personId) router.replace(`/notes/${id}`);
    else router.push(`/notes/${id}`);
  }

  function heard(note) {
    if (note.to_id !== uid || note.heard_at) return;
    const at = new Date().toISOString();
    setNotes((ns) => ns.map((n) => (n.id === note.id ? { ...n, heard_at: at } : n)));
    setUnheardNotes((c) => Math.max(0, c - 1));
    markNotesHeard([note.id]).catch(() => {});
  }

  async function markAll() {
    const at = new Date().toISOString();
    setNotes((ns) => ns.map((n) => (n.to_id === uid && !n.heard_at ? { ...n, heard_at: at } : n)));
    setUnheardNotes(0);
    await markAllNotesHeard().catch(() => toast.error('Could not mark them heard.'));
  }

  function playNote(note) {
    const from = note.from_id === uid ? 'you' : person(note.from_id).name;
    player.toggle({
      id: note.id,
      audioPath: note.audio_path,
      title: `Voice note from ${from}`,
      artist: from,
      seed: note.id,
      durationSeconds: note.duration,
      peaks: note.peaks || null,
      onStart: () => heard(note),
    });
  }

  async function unsend(note) {
    setNotes((ns) => ns.filter((n) => n.id !== note.id));
    try {
      await unsendVoiceNote(note);
    } catch (err) {
      setNotes((ns) => [...ns, note].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)));
      toast.error(err.message || 'Could not unsend that.');
    }
  }

  // ---- the list ------------------------------------------------------------

  function renderList() {
    return (
      <View style={twoPane ? styles.listPaneSide : styles.listPane} testID="notes-list">
        <ScrollView contentContainerStyle={styles.listContent}>
          {!twoPane ? (
            <TouchableOpacity
              style={styles.back}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            >
              <Ionicons name="arrow-back" size={20} color={colors.emberInk} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.listHead}>
            <Text style={styles.title}>Voice notes</Text>
            {list.some((c) => c.unheard > 0) ? (
              <TouchableOpacity onPress={markAll} testID="notes-mark-all">
                <Text style={styles.link}>Mark all heard</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.filters}>
            {FILTERS.map((f) => {
              const on = filter === f.key;
              const n = counts[f.key];
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[styles.filter, on && styles.filterOn]}
                  testID={`notes-filter-${f.key}`}
                >
                  <Text style={[styles.filterText, on && styles.filterTextOn]}>
                    {f.label}
                    {n ? ` · ${n}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.ember} style={styles.spinner} />
          ) : shown.length === 0 ? (
            <Text style={styles.quiet}>
              {list.length === 0
                ? 'No voice notes yet. They’re just between two people — a quick “I loved this bit”, or a reply to a moment in a cast.'
                : filter === 'unheard'
                  ? 'You’ve heard everything.'
                  : 'Nobody’s waiting on you.'}
            </Text>
          ) : (
            shown.map((c) => {
              const p = person(c.personId);
              const state = conversationState(c, uid);
              const about = c.threads[0];
              const on = c.personId === personId;
              return (
                <TouchableOpacity
                  key={c.personId}
                  style={[styles.convo, on && styles.convoOn]}
                  onPress={() => open(c.personId)}
                  activeOpacity={0.8}
                  testID="notes-convo"
                >
                  <Avatar name={p.name} path={p.avatar_path} size={40} />
                  <View style={styles.convoMain}>
                    <View style={styles.convoTop}>
                      <Text style={styles.convoName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.convoWhen}>{timeAgo(c.last.created_at)}</Text>
                    </View>
                    <Text style={styles.convoAbout} numberOfLines={1}>
                      {about.castId ? `On ${about.castTitle}` : 'Just chat'}
                      {texts[c.last.id] ? ` · “${texts[c.last.id]}”` : ''}
                    </Text>
                    <Text
                      style={[
                        styles.convoState,
                        state.tone === 'new' && styles.stateNew,
                        state.tone === 'done' && styles.stateDone,
                      ]}
                    >
                      {state.text}
                    </Text>
                  </View>
                  {c.unheard > 0 ? <View style={styles.dot} accessibilityLabel="Unheard" /> : null}
                </TouchableOpacity>
              );
            })
          )}

          {!loading && unstarted.length > 0 ? (
            <View style={styles.start}>
              <Text style={styles.startLabel}>Start one with</Text>
              <View style={styles.startRow}>
                {unstarted.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={styles.startChip}
                    onPress={() => open(f.id)}
                    testID="notes-start"
                  >
                    <Avatar name={f.name} path={f.avatar_path} size={22} />
                    <Text style={styles.startName}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  // ---- one conversation ----------------------------------------------------

  function renderConversation() {
    const p = person(personId);
    const threads = [...(current?.threads || [])];
    if (!threads.some((t) => t.key === CHAT)) {
      threads.push({ key: CHAT, castId: null, castTitle: null, notes: [], unheard: 0 });
    }
    if (linkedCast && !threads.some((t) => t.key === linkedCast)) {
      threads.unshift({
        key: linkedCast,
        castId: linkedCast,
        castTitle: typeof params.title === 'string' ? params.title : 'this cast',
        notes: [],
        unheard: 0,
      });
    }
    const selected = threads.find((t) => t.key === threadKey) || threads[0];

    return (
      <View style={styles.convoPane} testID="notes-conversation">
        <View style={styles.convoHeader}>
          {!twoPane ? (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/notes'))}
              accessibilityLabel="Back to voice notes"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.emberInk} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.who}
            onPress={() => router.push(`/person/${personId}`)}
            activeOpacity={0.8}
          >
            <Avatar name={p.name} path={p.avatar_path} size={40} />
            <View>
              <Text style={styles.whoName}>{p.name}</Text>
              <Text style={styles.whoSub}>Just the two of you</Text>
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.threadBar}
          contentContainerStyle={styles.threadRow}
        >
          {threads.map((t) => {
            const on = t.key === selected.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setThreadKey(t.key)}
                style={[styles.thread, on && styles.threadOn]}
                testID="notes-thread"
              >
                <Text style={[styles.threadText, on && styles.threadTextOn]} numberOfLines={1}>
                  {t.castId ? `About “${t.castTitle}”` : 'Just chat'}
                </Text>
                {t.unheard > 0 ? <View style={styles.threadDot} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView
          ref={scrollRef}
          style={styles.bubbles}
          contentContainerStyle={styles.bubblesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: false })}
        >
          {selected.castId ? (
            <TouchableOpacity
              style={styles.castLink}
              onPress={() => router.push(`/cast/${selected.castId}`)}
            >
              <Ionicons name="radio-outline" size={14} color={colors.inkSoft} />
              <Text style={styles.castLinkText} numberOfLines={1}>
                Thread on <Text style={styles.castLinkTitle}>{selected.castTitle}</Text>
              </Text>
            </TouchableOpacity>
          ) : null}
          {selected.notes.length === 0 ? (
            <Text style={styles.empty}>
              Nothing here yet. Say hello to {firstName(personId)} — only they will hear it.
            </Text>
          ) : (
            selected.notes.map((n) => renderBubble(n, p))
          )}
        </ScrollView>

        <NoteRecorder
          toId={personId}
          toName={firstName(personId)}
          castId={selected.castId}
          reply={reply && reply.castId === selected.castId ? reply : null}
          onClearReply={() => setReply(null)}
          onSent={(note) => {
            setNotes((ns) => [...ns, note]);
            setThreadKey(note.cast_id || CHAT);
          }}
        />
      </View>
    );
  }

  function renderBubble(n, p) {
    const mine = n.from_id === uid;
    const isCurrent = player.track?.id === n.id;
    const playing = isCurrent && player.isPlaying;
    const total = isCurrent && player.duration ? player.duration : (n.duration || 0) * 1000;
    const progress = isCurrent && total ? player.position / total : 0;
    const text = texts[n.id];
    const fresh = !mine && !n.heard_at;
    return (
      <View key={n.id} style={[styles.bubbleWrap, mine && styles.bubbleWrapMine]} testID="note">
        {n.at_ms != null && n.cast_id ? (
          <TouchableOpacity
            style={styles.moment}
            onPress={() => router.push(`/cast/${n.cast_id}?at=${n.at_ms}`)}
            accessibilityLabel={`Play the cast from ${formatClock(n.at_ms)}`}
          >
            <Text style={styles.momentText}>
              ↳ at {formatClock(n.at_ms)}
              {n.cast_title ? ` in ${n.cast_title}` : ''}
            </Text>
          </TouchableOpacity>
        ) : null}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <TouchableOpacity
            onPress={() => playNote(n)}
            style={[styles.play, mine ? styles.playMine : styles.playTheirs]}
            accessibilityLabel={playing ? 'Pause' : 'Play voice note'}
            testID="note-play"
          >
            {isCurrent && player.loading ? (
              <ActivityIndicator size="small" color={colors.onEmber} />
            ) : (
              <Ionicons
                name={playing ? 'pause' : 'play'}
                size={16}
                color={colors.onEmber}
                style={playing ? null : styles.playNudge}
              />
            )}
          </TouchableOpacity>
          <Waveform
            seed={n.id}
            peaks={n.peaks}
            bars={34}
            height={28}
            progress={progress}
            playedColor={mine ? colors.emberInk : colors.emberSoft}
            idleColor={colors.smoke}
            style={styles.bubbleWave}
          />
          <Text style={styles.len}>{formatClock(total)}</Text>
        </View>
        {text ? (
          <Text style={[styles.said, mine && styles.saidMine]} numberOfLines={6}>
            {text}
          </Text>
        ) : null}
        <View style={[styles.metaRow, mine && styles.metaRowMine]}>
          <Text style={[styles.meta, fresh && styles.metaNew]}>
            {mine
              ? `${n.heard_at ? `${firstName(personId)} heard it ✓` : 'Sent'} · ${timeAgo(n.created_at)}`
              : `${p.name} · ${timeAgo(n.created_at)}${fresh ? ' · new' : ''}`}
          </Text>
          {mine && !n.heard_at ? (
            <TouchableOpacity onPress={() => unsend(n)} testID="note-unsend">
              <Text style={styles.unsend}>Unsend</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  function renderPick() {
    return (
      <View style={styles.pick}>
        <Ionicons name="chatbubbles-outline" size={34} color={colors.emberSoft} />
        <Text style={styles.pickTitle}>Little recordings, just between two people.</Text>
        <Text style={styles.quiet}>
          Pick someone on the left to listen — or reply to a moment from any cast’s page.
        </Text>
      </View>
    );
  }

  if (twoPane) {
    return (
      <View style={[styles.container, styles.twoPane]}>
        {renderList()}
        {personId ? renderConversation() : renderPick()}
      </View>
    );
  }
  return <View style={styles.container}>{personId ? renderConversation() : renderList()}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  twoPane: { flexDirection: 'row' },
  listPane: { flex: 1 },
  listPaneSide: { width: 360, borderRightWidth: 1, borderRightColor: colors.hairline },
  listContent: { padding: space.lg, paddingTop: space.xl },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.lg },
  backText: { ...type.label, color: colors.emberInk },
  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  title: { ...type.h1, color: colors.ink },
  link: { ...type.label, color: colors.emberInk },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.lg },
  filter: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.smoke,
  },
  filterOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { ...type.label, color: colors.inkSoft },
  filterTextOn: { color: colors.onEmber },
  spinner: { marginTop: space.xl },
  quiet: { ...type.bodySm, color: colors.inkMuted, marginTop: space.sm },
  convo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    marginHorizontal: -space.sm,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  convoOn: { backgroundColor: colors.surface },
  convoMain: { flex: 1, minWidth: 0 },
  convoTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  convoName: { ...type.h3, color: colors.ink, flexShrink: 1 },
  convoWhen: { ...type.time, fontSize: 11, color: colors.inkMuted },
  convoAbout: { ...type.bodySm, color: colors.inkSoft },
  convoState: { ...type.caption, color: colors.inkMuted, marginTop: 2 },
  stateNew: { color: colors.emberSoft, fontFamily: type.h3.fontFamily },
  stateDone: { color: colors.success },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.emberSoft, marginTop: 6 },
  start: { marginTop: space.xl },
  startLabel: { ...type.eyebrow, color: colors.inkMuted, marginBottom: space.sm },
  startRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  startChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: space.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.smoke,
  },
  startName: { ...type.label, color: colors.ink },

  convoPane: { flex: 1, minWidth: 0 },
  convoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  whoName: { ...type.h3, color: colors.ink, fontSize: 18 },
  whoSub: { ...type.caption, color: colors.inkMuted },
  threadBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  threadRow: { gap: 6, paddingHorizontal: space.lg, paddingVertical: space.sm },
  thread: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.smoke,
    maxWidth: 260,
  },
  threadOn: { backgroundColor: colors.surfaceRaised, borderColor: colors.surfaceRaised },
  threadText: { ...type.label, color: colors.inkSoft },
  threadTextOn: { color: colors.ink },
  threadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.emberSoft },
  bubbles: { flex: 1 },
  bubblesContent: { padding: space.lg, gap: space.lg },
  castLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceSunk,
    maxWidth: '100%',
  },
  castLinkText: { ...type.caption, color: colors.inkSoft, flexShrink: 1 },
  castLinkTitle: { color: colors.ink, fontFamily: type.h3.fontFamily },
  empty: { ...type.bodySm, color: colors.inkMuted, textAlign: 'center', marginTop: space.xl },
  bubbleWrap: { alignSelf: 'flex-start', maxWidth: 460, width: '86%', gap: 4 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  moment: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSurface,
  },
  momentText: { ...type.time, fontSize: 12, color: colors.emberSoft },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.md,
    borderRadius: 22,
    borderWidth: 1,
    alignSelf: 'stretch',
  },
  bubbleTheirs: { backgroundColor: colors.surface, borderColor: colors.hairline },
  bubbleMine: { backgroundColor: colors.accentSurface, borderColor: colors.smoke },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  playTheirs: { backgroundColor: colors.emberSoft },
  playMine: { backgroundColor: colors.ink },
  playNudge: { marginLeft: 2 },
  bubbleWave: { flex: 1 },
  len: { ...type.time, fontSize: 12, color: colors.inkSoft },
  said: { ...type.bodySm, color: colors.inkSoft, paddingHorizontal: space.sm },
  saidMine: { textAlign: 'right' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: 4 },
  metaRowMine: { justifyContent: 'flex-end' },
  meta: { ...type.caption, color: colors.inkMuted },
  metaNew: { color: colors.emberSoft },
  unsend: { ...type.caption, color: colors.inkFaint, textDecorationLine: 'underline' },
  pick: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space['2xl'],
    gap: space.sm,
  },
  pickTitle: {
    fontFamily: type.moment.fontFamily,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    textAlign: 'center',
  },
});
