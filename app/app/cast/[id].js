import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CastCover from '../../src/components/CastCover';
import AudioPlayer from '../../src/components/AudioPlayer';
import MiniPlayer from '../../src/components/MiniPlayer';
import {
  getCast,
  getAudioUrl,
  getRecipients,
  deleteCast,
  getComments,
  addComment,
  deleteComment,
} from '../../src/api/client';
import { usePlayer } from '../../src/context/PlayerContext';
import { useToast } from '../../src/context/ToastContext';
import { showAlert } from '../../src/utils/alert';
import { fonts } from '../../src/theme/typography';

function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function timeAgo(dateString) {
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

function BackButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.backButton} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name="arrow-back" size={20} color="#E8734A" />
      <Text style={styles.backText}>Back</Text>
    </TouchableOpacity>
  );
}

export default function CastDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { track, stop } = usePlayer();

  const [cast, setCast] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCast(id)
      .then((c) => {
        if (!active) return;
        setCast(c);
        if (c?.audio_path) getAudioUrl(c.audio_path).then((u) => active && setAudioUrl(u));
        // Recipients are only meaningful (and visible) to the creator/sharer.
        if (c && !c.shared_with_me) getRecipients(id).then((r) => active && setRecipients(r));
        // Comments are visible to anyone who can access the cast.
        if (c) getComments(id).then((cs) => active && setComments(cs));
      })
      .catch(() => active && setCast(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  async function handlePostComment() {
    const body = commentText.trim();
    if (!body) return;
    setPosting(true);
    try {
      const comment = await addComment(id, body);
      setComments((prev) => [...prev, comment]);
      setCommentText('');
    } catch (err) {
      toast.error(err.message || 'Could not post your comment.');
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteComment(commentId) {
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E8734A" />
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
              <Ionicons name="lock-closed-outline" size={34} color="#E8734A" />
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

  const byline = cast.shared_with_me
    ? `Shared by ${cast.sharer_name || cast.creator_name}`
    : cast.creator_name;
  const participantList = Array.isArray(cast.participants) ? cast.participants : [];

  return (
    <View style={styles.container} testID="cast-detail">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <BackButton onPress={goBack} />

        <View style={styles.hero}>
          <CastCover seed={cast.id} title={cast.title} size={96} />
          <Text style={styles.title}>{cast.title}</Text>
          <Text style={styles.byline}>
            {byline} · {formatDate(cast.created_at)}
          </Text>
        </View>

        {audioUrl ? (
          <AudioPlayer
            uri={audioUrl}
            style={styles.player}
            castId={cast.id}
            title={cast.title}
            seed={cast.id}
            artist={cast.shared_with_me ? cast.sharer_name || cast.creator_name : cast.creator_name}
            durationSeconds={cast.duration}
          />
        ) : null}

        {cast.summary || cast.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Summary</Text>
            <Text style={styles.bodyText}>{cast.summary || cast.description}</Text>
          </View>
        ) : null}

        {participantList.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>In this cast</Text>
            <View style={styles.tagRow}>
              {participantList.map((name, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!cast.shared_with_me && recipients.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>
              Shared with {recipients.length} {recipients.length === 1 ? 'person' : 'people'}
            </Text>
            <View style={styles.tagRow}>
              {recipients.map((r) => (
                <View key={r.id} style={styles.tag}>
                  <Text style={styles.tagText}>{r.name || r.email}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section} testID="comments">
          <Text style={styles.sectionHeading}>Comments</Text>

          {comments.length === 0 ? (
            <Text style={styles.commentsEmpty}>No comments yet — start the conversation.</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.comment} testID="comment-row">
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>{c.author_name}</Text>
                  <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                  {c.mine || !cast.shared_with_me ? (
                    <TouchableOpacity
                      onPress={() => handleDeleteComment(c.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Delete comment"
                      testID="comment-delete"
                      style={styles.commentDelete}
                    >
                      <Ionicons name="close" size={15} color="#C9B8A8" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
            ))
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              placeholderTextColor="#C4B5A8"
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
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
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
              <ActivityIndicator size="small" color="#C0392B" />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#C0392B" />
            )}
            <Text style={styles.deleteText}>Delete cast</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F0',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 32,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#E8734A',
    marginLeft: 4,
  },
  hero: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
    textAlign: 'center',
    marginTop: 16,
  },
  byline: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#A89888',
    marginTop: 6,
    textAlign: 'center',
  },
  player: {
    marginBottom: 12,
  },
  section: {
    marginTop: 20,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#A89888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#6B5E50',
    lineHeight: 23,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#FFF0E6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 13,
    color: '#E8734A',
    fontFamily: fonts.medium,
  },
  commentsEmpty: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#A89888',
    marginBottom: 12,
  },
  comment: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
  },
  commentTime: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#A89888',
    marginLeft: 8,
    flex: 1,
  },
  commentDelete: {
    padding: 2,
  },
  commentBody: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#6B5E50',
    lineHeight: 20,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E6DA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#2D2D2D',
    maxHeight: 120,
  },
  commentPost: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8734A',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  commentPostOff: {
    opacity: 0.45,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 32,
    paddingVertical: 8,
  },
  deleteText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#C0392B',
    marginLeft: 8,
  },
  missing: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 12,
  },
  missingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FCEDE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  missingTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
    marginBottom: 10,
  },
  missingBody: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#8C7B6B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
