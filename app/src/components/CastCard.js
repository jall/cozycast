import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AudioPlayer from './AudioPlayer';
import CastCover from './CastCover';
import { getAudioUrl, deleteCast } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';
import { showAlert } from '../utils/alert';
import { fonts } from '../theme/typography';

function timeAgo(dateString) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return `${diffWeek}w ago`;
}

export default function CastCard({ cast, index = 0, onDeleted }) {
  const {
    id,
    title,
    summary,
    description,
    creator_name,
    sharer_name,
    participants,
    recipient_count,
    shared_with_me,
    created_at,
  } = cast;

  const [audioUrl, setAudioUrl] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const { track, stop } = usePlayer();

  const openDetail = () => router.push(`/cast/${id}`);

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
      // If this is what the mini player is playing, dismiss it too.
      if (track?.id === id) await stop();
      toast.success('Cast deleted.');
      onDeleted?.(id);
    } catch (err) {
      toast.error(err.message || 'Could not delete that cast.');
      setDeleting(false);
    }
  }

  // Gentle staggered fade-in-up as cards arrive in the feed.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 360,
      delay: Math.min(index, 8) * 55,
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  useEffect(() => {
    if (cast.audio_path) getAudioUrl(cast.audio_path).then(setAudioUrl);
  }, [cast.audio_path]);

  const body = summary || description;
  const participantList = Array.isArray(participants) ? participants : [];

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.headerPress}
          onPress={openDetail}
          activeOpacity={0.7}
          accessibilityLabel={`Open ${title}`}
        >
          <CastCover seed={id} title={title} size={56} />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.byline}>
              {shared_with_me ? `Shared by ${sharer_name || creator_name}` : creator_name} ·{' '}
              {timeAgo(created_at)}
            </Text>
          </View>
        </TouchableOpacity>
        {!shared_with_me ? (
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={deleting}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Delete cast"
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#C0392B" />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#C9B8A8" />
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {body ? (
        <TouchableOpacity onPress={openDetail} activeOpacity={0.7}>
          <Text style={styles.summary} numberOfLines={4}>
            {body}
          </Text>
        </TouchableOpacity>
      ) : null}

      {participantList.length > 0 && (
        <View style={styles.participantsRow}>
          <Ionicons
            name="people-outline"
            size={14}
            color="#A89888"
            style={styles.participantsIcon}
          />
          {participantList.map((name, i) => (
            <View key={i} style={styles.participantTag}>
              <Text style={styles.participantText}>{name}</Text>
            </View>
          ))}
        </View>
      )}

      {audioUrl && (
        <AudioPlayer
          uri={audioUrl}
          style={styles.player}
          castId={id}
          title={title}
          seed={id}
          artist={shared_with_me ? sharer_name || creator_name : creator_name}
          durationSeconds={cast.duration}
        />
      )}

      {!shared_with_me && recipient_count > 0 ? (
        <Text style={styles.sharedNote}>
          Shared with {recipient_count} {recipient_count === 1 ? 'person' : 'people'}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 14,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
    marginBottom: 4,
  },
  byline: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#A89888',
  },
  summary: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#6B5E50',
    lineHeight: 20,
    marginBottom: 12,
  },
  participantsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  participantsIcon: {
    marginRight: 6,
  },
  participantTag: {
    backgroundColor: '#FFF0E6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  participantText: {
    fontSize: 12,
    color: '#E8734A',
    fontFamily: fonts.medium,
  },
  player: {
    marginTop: 4,
  },
  sharedNote: {
    fontSize: 12,
    color: '#A89888',
    marginTop: 8,
  },
});
