import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CastCover from '../../src/components/CastCover';
import Glow from '../../src/components/Glow';
import PlayerDeck from '../../src/components/PlayerDeck';
import MiniPlayer from '../../src/components/MiniPlayer';
import Avatar from '../../src/components/Avatar';
import Faces from '../../src/components/Faces';
import InvitePanel from '../../src/components/InvitePanel';
import Waveform from '../../src/components/Waveform';
import Transcript from '../../src/components/Transcript';
import useLayout from '../../src/hooks/useLayout';
import { cachedCast, rememberCasts } from '../../src/utils/castCache';
import {
  getCast,
  getRecipients,
  getFriends,
  shareCast,
  removeRecipient,
  deleteCast,
  getComments,
  addComment,
  deleteComment,
  markPlayed,
  updateCast,
  finishTogetherCast,
  getTranscripts,
  requestTranscript,
  getAudioUrl,
  savePeaks,
} from '../../src/api/client';
import { usePlayer } from '../../src/context/PlayerContext';
import { useToast } from '../../src/context/ToastContext';
import { useAuth } from '../../src/context/AuthContext';
import { useShell } from '../../src/context/ShellContext';
import { makersOf, turnState, togetherShape } from '../../src/utils/turns';
import { showAlert } from '../../src/utils/alert';
import { timeAgo } from '../../src/utils/time';
import { formatClock } from '../../src/utils/waveform';
import { castBy, trackFor } from '../../src/utils/track';
import { castByIdOf } from '../../src/utils/people';
import { coverFor } from '../../src/utils/castCover';
import { computePeaks } from '../../src/utils/peaks';
import { colors } from '../../src/theme/colors';
import { type } from '../../src/theme/type';
import { space, radius, layout } from '../../src/theme/space';

function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

// Casts we've already tried to backfill peaks for this session, so a decode
// that fails doesn't re-download the audio every time the page opens.
const peaksTried = new Set();
// Likewise for asking for a transcript.
const transcriptTried = new Set();

function BackButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.backButton} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name="arrow-back" size={20} color={colors.emberInk} />
      <Text style={styles.backText}>Back</Text>
    </TouchableOpacity>
  );
}

export default function CastDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { track, position, seek, play, stop } = usePlayer();
  const { setTab, setTurnFor } = useShell();
  const [finishing, setFinishing] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [writingDown, setWritingDown] = useState(false);
  const { content } = useLayout();
  // On a laptop the cast reads as two columns: the cover and player on the
  // left, everything said about it on the right.
  const twoCol = content >= 1000;

  // Opened from the feed? Paint straight away from what it already loaded;
  // the full detail refreshes behind it.
  const [cast, setCast] = useState(() => cachedCast(id));
  const [recipients, setRecipients] = useState([]);
  const [friends, setFriends] = useState([]);
  const [managing, setManaging] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  // Editing the title/summary (creator or sharer only).
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  // The moment (ms) a new comment will be pinned to, or null for a general one.
  const [pinAt, setPinAt] = useState(null);
  const [loading, setLoading] = useState(() => !cachedCast(id));
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [id, enter]);
  const [deleting, setDeleting] = useState(false);

  const recipientIds = new Set(recipients.map((r) => r.id));

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  useEffect(() => {
    let active = true;
    const cached = cachedCast(id);
    if (cached) setCast((c) => (c?.id === id ? c : cached));
    setLoading(!cached);
    getCast(id)
      .then((c) => {
        if (!active) return;
        setCast(c);
        // Recipients + the address book are only needed by a manager (creator
        // or assigned sharer), who can add/remove who the cast is shared with.
        if (c?.can_manage) {
          getRecipients(id).then((r) => active && setRecipients(r));
          getFriends()
            .then((f) => active && setFriends(f))
            .catch(() => {});
        }
        // Comments are visible to anyone who can access the cast.
        if (c) getComments(id).then((cs) => active && setComments(cs));
        // What was said. Missing (an older cast, or still being written)? Ask
        // for it once per session; it comes back with the reply.
        if (c?.audio_path) {
          getTranscripts(id).then((ts) => {
            if (!active) return;
            setTranscripts(ts);
            const expected = c.together ? (c.turns || []).length : 1;
            if (ts.length >= expected || transcriptTried.has(id)) return;
            transcriptTried.add(id);
            setWritingDown(true);
            requestTranscript(id)
              .then((r) => active && r?.transcripts?.length && setTranscripts(r.transcripts))
              .catch(() => {})
              .finally(() => active && setWritingDown(false));
          });
        }
        // Opening a cast shared with you counts as hearing it (clears it from
        // the calm home's "waiting for you"). Best-effort, fire-and-forget.
        if (c?.shared_with_me) markPlayed(id).catch(() => {});
        // Casts uploaded before real waveforms existed: when someone who manages
        // it opens it (on web), measure its peaks once and store them, so every
        // card shows its true shape from then on. Quiet and best-effort.
        if (c?.owns && !c.together && !c.peaks && c.audio_path && !peaksTried.has(id)) {
          peaksTried.add(id);
          getAudioUrl(c.audio_path)
            .then(computePeaks)
            .then((peaks) => {
              if (!peaks) return;
              return savePeaks(id, peaks).then(() => active && setCast((p) => ({ ...p, peaks })));
            })
            .catch(() => {});
        }
      })
      .catch(() => active && setCast(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  async function toggleRecipient(friend) {
    const has = recipientIds.has(friend.id);
    const prev = recipients;
    // Optimistic: reflect the change immediately, revert on failure.
    setRecipients(has ? recipients.filter((r) => r.id !== friend.id) : [...recipients, friend]);
    try {
      if (has) await removeRecipient(id, friend.id);
      else await shareCast(id, [friend.id]);
    } catch (err) {
      setRecipients(prev);
      toast.error(err.message || 'Could not update who this is shared with.');
    }
  }

  async function handlePostComment() {
    const body = commentText.trim();
    if (!body) return;
    setPosting(true);
    try {
      const comment = await addComment(id, body, pinAt);
      setComments((prev) => [...prev, comment]);
      setCommentText('');
      setPinAt(null);
    } catch (err) {
      toast.error(err.message || 'Could not post your comment.');
    } finally {
      setPosting(false);
    }
  }

  function handleDeleteComment(commentId) {
    showAlert('Delete this comment?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => doDeleteComment(commentId) },
    ]);
  }

  async function doDeleteComment(commentId) {
    // Optimistic: drop it, restore on failure.
    const prev = comments;
    setComments((cs) => cs.filter((c) => c.id !== commentId));
    try {
      await deleteComment(commentId);
    } catch (err) {
      setComments(prev);
      toast.error(err.message || 'Could not delete that comment.');
    }
  }

  function startEdit() {
    setDraftTitle(cast.title || '');
    setDraftSummary(cast.summary || cast.description || '');
    setEditing(true);
  }

  async function saveEdit() {
    if (!draftTitle.trim()) {
      toast.error('A cast needs a title.');
      return;
    }
    setSavingEdit(true);
    try {
      await updateCast(id, { title: draftTitle, summary: draftSummary });
      const next = { ...cast, title: draftTitle.trim(), summary: draftSummary.trim() || null };
      setCast(next);
      rememberCasts([next]);
      setEditing(false);
      toast.success('Saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save your changes.');
    } finally {
      setSavingEdit(false);
    }
  }

  // Your turn on a cast made in turns: over to the record tab.
  function takeTurn() {
    setTurnFor(cast);
    setTab('record');
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  }

  function confirmFinish() {
    showAlert(
      'Finish it here?',
      'Nobody can add another turn after this. Then anyone in it can choose who hears it.',
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'We’re done', onPress: doFinish },
      ],
    );
  }

  async function doFinish() {
    setFinishing(true);
    try {
      await finishTogetherCast(id);
      setCast((c) => ({ ...c, finished_at: new Date().toISOString(), turn_with: null }));
      toast.success('Finished together — choose who hears it whenever you’re ready.');
    } catch (err) {
      toast.error(err.message || 'Could not finish it.');
    } finally {
      setFinishing(false);
    }
  }

  function confirmDelete() {
    showAlert(
      'Delete this cast?',
      'It’ll be removed for everyone it was shared with. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ],
    );
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await deleteCast(id, cast.audio_path);
      if (track?.id === id) await stop();
      toast.success('Cast deleted.');
      goBack();
    } catch (err) {
      toast.error(err.message || 'Could not delete that cast.');
      setDeleting(false);
    }
  }

  if (loading) {
    // Arrived cold (a shared link): a quiet silhouette of the page, not a spinner.
    return (
      <View style={styles.container}>
        <View style={[styles.scrollContent, styles.skeleton]} accessibilityLabel="Loading cast">
          <View style={styles.skeletonCover} />
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonLine} />
          <Waveform
            seed={id}
            bars={64}
            height={56}
            idleColor={colors.hairline}
            style={styles.skeletonWave}
          />
        </View>
      </View>
    );
  }

  if (!cast) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <BackButton onPress={goBack} />
          <View style={styles.missing}>
            <View style={styles.missingIcon}>
              <Ionicons name="lock-closed-outline" size={34} color={colors.ember} />
            </View>
            <Text style={styles.missingTitle}>This cast isn’t available</Text>
            <Text style={styles.missingBody}>
              It may have been deleted, or it hasn’t been shared with you. Only the people a cast is
              shared with can listen to it.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Everyone in it, not just whoever pressed record: "Jon & Ben".
  const makers = [
    cast.creator_id === user?.id ? 'You' : cast.creator_name,
    ...(cast.participant_people || [])
      .filter((p) => p.name !== cast.creator_name)
      .map((p) => (p.id && p.id === user?.id ? 'You' : p.name)),
  ];
  const byline = cast.can_manage ? makers.join(' & ') : `Shared by ${castBy(cast)}`;
  // A cast belongs to everyone in it: any of them can fix its words and
  // choose who hears it.
  const canEdit = cast.can_manage;
  // Made in turns ("pass the mic").
  const turns = turnState(cast, user?.id);
  const shape = cast.together ? togetherShape(cast) : null;
  const turnMakers = cast.together ? makersOf(cast) : [];
  const holderName = cast.turn_with && turnMakers.find((m) => m.id === cast.turn_with)?.name;
  const participantList = Array.isArray(cast.participants) ? cast.participants : [];
  const castTrack = trackFor(cast);
  const isCurrent = track?.id === cast.id;
  const glow = coverFor(cast.id, cast.title).glow;

  // "Leave a note here" from the deck pins the comment to that moment.
  function noteAt(ms) {
    setPinAt(Math.round(ms));
  }

  function jumpTo(ms) {
    if (isCurrent) seek(ms);
    else play(castTrack, { startMillis: ms });
  }

  // The transcript, a part per recording (per turn, with who's speaking).
  const byPath = Object.fromEntries(transcripts.map((t) => [t.audio_path, t]));
  const transcriptParts = shape?.bands
    ? shape.bands.map((b) => ({
        key: b.turn.id || b.turn.audio_path,
        name: b.authorId === user?.id ? 'You' : b.name,
        color: b.color,
        offsetMs: b.startMs,
        segments: byPath[b.turn.audio_path]?.segments || [],
      }))
    : [{ key: 'cast', offsetMs: 0, segments: byPath[cast.audio_path]?.segments || [] }];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
      testID="cast-detail"
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, twoCol && styles.scrollWide]}
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={goBack} />
        <View style={twoCol ? styles.columns : null}>
          <View style={twoCol ? styles.leftCol : null}>
            <View style={styles.hero}>
              <Glow color={glow} strength={0.35} style={styles.halo} />
              <View style={[styles.coverWrap, { shadowColor: glow }]}>
                <CastCover seed={cast.id} title={cast.title} size={220} radius={radius.lg} />
              </View>
              {editing ? (
                <TextInput
                  style={[styles.title, styles.titleInput]}
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  placeholder="What's this about?"
                  placeholderTextColor={colors.inkFaint}
                  autoFocus
                  multiline
                  blurOnSubmit
                  maxLength={140}
                  accessibilityLabel="Title"
                  testID="edit-title"
                />
              ) : (
                <Text style={styles.title}>{cast.title}</Text>
              )}
              <TouchableOpacity
                style={styles.bylineRow}
                disabled={cast.creator_id === user?.id}
                onPress={() => router.push(`/person/${castByIdOf(cast)}`)}
                activeOpacity={0.7}
              >
                <Avatar
                  name={castBy(cast)}
                  path={
                    cast.shared_with_me
                      ? cast.sharer_avatar || cast.creator_avatar
                      : cast.creator_avatar
                  }
                  size={20}
                  style={styles.bylineAvatar}
                />
                <Text style={styles.byline}>
                  {byline} · {formatDate(cast.created_at)}
                </Text>
              </TouchableOpacity>
              {canEdit && !editing ? (
                <TouchableOpacity
                  onPress={startEdit}
                  style={styles.editButton}
                  accessibilityLabel="Edit title and summary"
                  testID="edit-cast"
                >
                  <Ionicons name="pencil" size={13} color={colors.inkSoft} />
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {cast.audio_path ? (
              <PlayerDeck cast={castTrack} notes={comments} onNote={noteAt} style={styles.player} />
            ) : null}

            {turns ? (
              <View style={styles.turnsBox} testID="turns">
                <Text style={styles.turnsEyebrow}>
                  {turns === 'finished'
                    ? `Made together · ${cast.turns.length} ${cast.turns.length === 1 ? 'turn' : 'turns'}`
                    : turns === 'yours'
                      ? 'The mic’s with you'
                      : `The mic’s with ${holderName || 'them'}`}
                </Text>
                {(shape?.bands || []).map((b, i) => (
                  <TouchableOpacity
                    key={b.turn.id || i}
                    style={[styles.turnRow, { borderLeftColor: b.color }]}
                    onPress={() => jumpTo(b.startMs)}
                    activeOpacity={0.75}
                    accessibilityLabel={`Play ${b.name}'s turn`}
                    testID="turn-row"
                  >
                    <View style={styles.turnRowHead}>
                      <Text style={[styles.turnWho, { color: b.color }]}>
                        {b.authorId === user?.id ? 'You' : b.name}
                      </Text>
                      <Text style={styles.turnLen}>
                        {formatClock(b.startMs)} · {formatClock(b.durMs)}
                      </Text>
                    </View>
                    {b.turn.question ? (
                      <Text style={styles.turnQuestion}>“{b.turn.question}”</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
                {turns === 'yours' ? (
                  <TouchableOpacity
                    style={styles.turnGo}
                    onPress={takeTurn}
                    activeOpacity={0.85}
                    testID="take-turn"
                  >
                    <Ionicons name="mic" size={17} color={colors.onEmber} />
                    <Text style={styles.turnGoText}>Record your turn</Text>
                  </TouchableOpacity>
                ) : null}
                {turns !== 'finished' ? (
                  <TouchableOpacity
                    style={styles.turnDone}
                    onPress={confirmFinish}
                    disabled={finishing}
                    activeOpacity={0.7}
                    testID="finish-cast"
                  >
                    {finishing ? (
                      <ActivityIndicator size="small" color={colors.ink} />
                    ) : (
                      <Text style={styles.turnDoneText}>We’re done — finish it</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={twoCol ? styles.rightCol : null}>
            {editing ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>Summary</Text>
                <TextInput
                  style={styles.summaryInput}
                  value={draftSummary}
                  onChangeText={setDraftSummary}
                  placeholder="A little about the conversation…"
                  placeholderTextColor={colors.inkFaint}
                  multiline
                  accessibilityLabel="Summary"
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={() => setEditing(false)}
                    style={styles.editCancel}
                    disabled={savingEdit}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveEdit}
                    style={styles.editSave}
                    disabled={savingEdit}
                    testID="save-cast"
                  >
                    {savingEdit ? (
                      <ActivityIndicator size="small" color={colors.onEmber} />
                    ) : (
                      <Text style={styles.editSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : cast.summary || cast.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>Summary</Text>
                <Text style={styles.bodyText}>{cast.summary || cast.description}</Text>
              </View>
            ) : null}

            <Transcript
              parts={transcriptParts}
              position={isCurrent ? position : null}
              onSeek={jumpTo}
              writing={writingDown}
            />

            {participantList.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>In this cast</Text>
                <View style={styles.tagRow}>
                  <Faces
                    names={participantList}
                    size={28}
                    ringColor={colors.bg}
                    style={styles.faces}
                  />
                  {(cast.participant_people || participantList.map((name) => ({ name }))).map(
                    (p, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.tag}
                        disabled={!p.id}
                        onPress={() => router.push(`/person/${p.id}`)}
                        accessibilityLabel={p.id ? `Open ${p.name}` : undefined}
                      >
                        <Text style={styles.tagText}>{p.name}</Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
              </View>
            ) : null}

            {cast.can_manage && turns && turns !== 'finished' ? (
              <View style={styles.section}>
                <View style={styles.privateNote}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.emberInk} />
                  <Text style={styles.privateText}>
                    Only the people in it can hear it while you’re making it. Once it’s finished,
                    any of you can choose who else hears it.
                  </Text>
                </View>
              </View>
            ) : cast.can_manage ? (
              <View style={styles.section}>
                <View style={styles.manageHeader}>
                  <Text style={styles.sectionHeading}>
                    {recipients.length > 0
                      ? `Shared with ${recipients.length} ${
                          recipients.length === 1 ? 'person' : 'people'
                        }`
                      : 'Not shared yet'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setManaging((m) => !m)}
                    testID="manage-recipients"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.manageToggle}>{managing ? 'Done' : 'Manage'}</Text>
                  </TouchableOpacity>
                </View>

                {managing ? (
                  friends.length === 0 ? (
                    <View style={styles.inviteBox}>
                      <Text style={styles.commentsEmpty}>
                        Nobody’s around your fire yet. Invite someone — once they’ve joined, you can
                        share this with them.
                      </Text>
                      <InvitePanel compact />
                    </View>
                  ) : (
                    friends.map((f) => {
                      const selected = recipientIds.has(f.id);
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={styles.recipientRow}
                          onPress={() => toggleRecipient(f)}
                          activeOpacity={0.7}
                          testID="recipient-row"
                        >
                          <Avatar
                            name={f.name}
                            path={f.avatar_path}
                            size={36}
                            style={styles.recipientAvatar}
                          />
                          <View style={styles.recipientInfo}>
                            <Text style={styles.recipientName}>{f.name}</Text>
                            {f.email ? <Text style={styles.recipientEmail}>{f.email}</Text> : null}
                          </View>
                          <Ionicons
                            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={24}
                            color={selected ? colors.ember : colors.inkFaint}
                          />
                        </TouchableOpacity>
                      );
                    })
                  )
                ) : recipients.length > 0 ? (
                  <View style={styles.tagRow}>
                    {recipients.map((r) => (
                      <View key={r.id} style={styles.tag}>
                        <Text style={styles.tagText}>{r.name || r.email}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.privateNote}>
                    <Ionicons name="lock-closed-outline" size={16} color={colors.emberInk} />
                    <Text style={styles.privateText}>
                      {participantList.length > 0
                        ? 'Only the people in it can hear this. Tap Manage to choose who gathers round.'
                        : 'Only you can hear this. Tap Manage to choose who gathers round.'}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.section} testID="comments">
              <Text style={styles.momentHeading}>Along the way</Text>

              {comments.length === 0 ? (
                <Text style={styles.commentsEmpty}>No notes yet — start the conversation.</Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.comment} testID="comment-row">
                    <Avatar
                      name={c.author_name}
                      path={c.author_avatar}
                      size={32}
                      style={styles.commentAvatar}
                    />
                    <View style={styles.commentMain}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>{c.author_name}</Text>
                        {c.at_ms != null ? (
                          <TouchableOpacity
                            onPress={() => jumpTo(c.at_ms)}
                            style={styles.at}
                            accessibilityLabel={`Jump to ${formatClock(c.at_ms)}`}
                          >
                            <Text style={styles.atText}>at {formatClock(c.at_ms)}</Text>
                          </TouchableOpacity>
                        ) : null}
                        <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                        {/* Author or a cast manager may delete (matches the RLS
                        cast_comments_delete_author_or_manager policy). */}
                        {c.mine || cast.can_manage ? (
                          <TouchableOpacity
                            onPress={() => handleDeleteComment(c.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Delete comment"
                            testID="comment-delete"
                            style={styles.commentDelete}
                          >
                            <Ionicons name="close" size={15} color={colors.inkFaint} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <Text style={styles.commentBody}>{c.body}</Text>
                    </View>
                  </View>
                ))
              )}

              {cast.audio_path ? (
                <View style={styles.pinRow}>
                  <TouchableOpacity
                    onPress={() =>
                      setPinAt((p) => (p != null ? null : Math.round(isCurrent ? position : 0)))
                    }
                    style={[styles.pin, pinAt != null && styles.pinOn]}
                    accessibilityLabel={
                      pinAt != null
                        ? `Pinned at ${formatClock(pinAt)} — tap to unpin`
                        : 'Pin to this moment'
                    }
                  >
                    <Ionicons
                      name={pinAt != null ? 'time' : 'time-outline'}
                      size={14}
                      color={pinAt != null ? colors.emberInk : colors.inkMuted}
                    />
                    <Text style={[styles.pinText, pinAt != null && styles.pinTextOn]}>
                      {pinAt != null
                        ? `Pinned at ${formatClock(pinAt)}`
                        : `Pin to ${formatClock(isCurrent ? position : 0)}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Add a comment…"
                  placeholderTextColor={colors.inkFaint}
                  multiline
                  testID="comment-input"
                />
                <TouchableOpacity
                  style={[
                    styles.commentPost,
                    (!commentText.trim() || posting) && styles.commentPostOff,
                  ]}
                  onPress={handlePostComment}
                  disabled={!commentText.trim() || posting}
                  activeOpacity={0.7}
                  testID="comment-post"
                >
                  {posting ? (
                    <ActivityIndicator size="small" color={colors.onEmber} />
                  ) : (
                    <Ionicons name="arrow-up" size={20} color={colors.onEmber} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {!cast.shared_with_me ? (
              <TouchableOpacity
                style={styles.deleteRow}
                onPress={confirmDelete}
                disabled={deleting}
                activeOpacity={0.7}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                )}
                <Text style={styles.deleteText}>Delete cast</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <MiniPlayer hideFor={cast.id} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: space.xl,
    paddingTop: 56,
    paddingBottom: space['2xl'],
    width: '100%',
    maxWidth: layout.feed - 60,
    alignSelf: 'center',
  },
  scrollWide: {
    maxWidth: 1180,
    paddingHorizontal: space['3xl'],
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftCol: {
    width: 420,
    marginRight: space['3xl'] + 16,
  },
  rightCol: {
    flex: 1,
    minWidth: 0,
    paddingTop: space.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: space.md,
  },
  backText: { ...type.label, color: colors.emberInk, marginLeft: space.xs },
  hero: { alignItems: 'center', marginTop: space.sm, marginBottom: space.lg },
  halo: {
    top: -90,
    left: '50%',
    marginLeft: -230,
    width: 460,
    height: 420,
  },
  coverWrap: {
    borderRadius: radius.lg,
    shadowOpacity: 0.45,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 24 },
  },
  title: { ...type.h1, color: colors.ink, textAlign: 'center', marginTop: space.xl },
  bylineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.xs + 2,
  },
  bylineAvatar: { marginRight: space.xs + 2 },
  byline: { ...type.bodySm, color: colors.inkMuted, textAlign: 'center' },
  player: { marginBottom: space.md },
  section: { marginTop: space.xl },
  sectionHeading: { ...type.eyebrow, color: colors.inkMuted, marginBottom: space.sm },
  momentHeading: {
    fontFamily: type.moment.fontFamily,
    fontSize: 21,
    lineHeight: 26,
    color: colors.ink,
    marginBottom: space.md,
  },
  faces: { marginRight: space.sm, marginBottom: space.sm },
  privateNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSurface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#6B3A28',
    padding: space.md,
  },
  privateText: { ...type.bodySm, color: colors.ink, marginLeft: space.sm, flex: 1 },
  at: {
    backgroundColor: colors.accentSurface,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: space.sm,
  },
  atText: { ...type.time, fontSize: 12, lineHeight: 16, color: colors.emberInk },
  pinRow: { flexDirection: 'row', marginTop: space.xs, marginBottom: space.sm },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.smoke,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
  },
  pinOn: { borderColor: '#6B3A28', backgroundColor: colors.accentSurface },
  pinText: { ...type.time, fontSize: 12, lineHeight: 16, color: colors.inkMuted, marginLeft: 6 },
  pinTextOn: { color: colors.emberInk },
  bodyText: { ...type.body, fontSize: 15, color: colors.inkSoft },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap' },
  tag: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  tagText: { ...type.caption, color: colors.emberInk, fontFamily: type.label.fontFamily },
  manageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  manageToggle: { ...type.label, color: colors.ember },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  recipientAvatar: { marginRight: space.md },
  recipientInfo: { flex: 1, marginRight: space.md },
  recipientName: { ...type.label, fontSize: 15, color: colors.ink },
  recipientEmail: { ...type.caption, color: colors.inkMuted, marginTop: 2 },
  commentsEmpty: { ...type.bodySm, color: colors.inkMuted, marginBottom: space.md },
  comment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: space.md,
    marginBottom: space.sm,
  },
  commentAvatar: { marginRight: space.sm },
  commentMain: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xs },
  commentAuthor: { ...type.caption, fontFamily: type.h3.fontFamily, color: colors.ink },
  commentTime: { ...type.caption, color: colors.inkMuted, marginLeft: space.sm, flex: 1 },
  commentDelete: { padding: 2 },
  commentBody: { ...type.bodySm, color: colors.inkSoft },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.xs },
  commentInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm + 2,
    ...type.bodySm,
    color: colors.ink,
    maxHeight: 120,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  commentPost: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.sm,
  },
  commentPostOff: { opacity: 0.45 },
  inviteBox: { marginTop: space.xs },
  titleInput: {
    alignSelf: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: colors.emberDeep,
    paddingVertical: space.xs,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  turnsBox: { marginBottom: space.lg },
  turnsEyebrow: { ...type.monoLabel, color: colors.emberSoft, marginBottom: space.md },
  turnRow: {
    borderLeftWidth: 3,
    paddingLeft: space.md,
    paddingVertical: space.sm,
    marginBottom: space.sm,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  turnRowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  turnWho: { ...type.h3 },
  turnLen: { ...type.time, color: colors.inkMuted },
  turnQuestion: {
    ...type.moment,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
    color: colors.inkSoft,
    marginTop: 2,
  },
  turnGo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.ember,
    marginTop: space.md,
  },
  turnGoText: { ...type.h3, color: colors.onEmber },
  turnDone: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.smoke,
    marginTop: space.sm,
  },
  turnDoneText: { ...type.h3, color: colors.ink },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.smoke,
  },
  editText: { ...type.label, color: colors.inkSoft, marginLeft: 6 },
  summaryInput: {
    ...type.body,
    fontSize: 15,
    color: colors.ink,
    minHeight: 96,
    textAlignVertical: 'top',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    padding: space.md,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: space.md,
  },
  editCancel: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2 },
  editCancelText: { ...type.label, color: colors.inkSoft },
  editSave: {
    minWidth: 88,
    alignItems: 'center',
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    marginLeft: space.sm,
  },
  editSaveText: { ...type.h3, fontSize: 14, color: colors.onEmber },
  skeleton: { alignItems: 'center' },
  skeletonWave: { alignSelf: 'stretch' },
  skeletonCover: {
    width: 220,
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginTop: 56,
  },
  skeletonTitle: {
    width: 260,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.surface,
    marginTop: space.xl,
  },
  skeletonLine: {
    width: 180,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surface,
    marginTop: space.md,
    marginBottom: space['2xl'],
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: space['2xl'],
    paddingVertical: space.sm,
  },
  deleteText: { ...type.label, fontSize: 15, color: colors.danger, marginLeft: space.sm },
  missing: { alignItems: 'center', paddingTop: 64, paddingHorizontal: space.md },
  missingIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  missingTitle: { ...type.h2, color: colors.ink, marginBottom: space.sm + 2 },
  missingBody: { ...type.body, fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
});
