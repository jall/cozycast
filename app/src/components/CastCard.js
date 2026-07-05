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
import Avatar from './Avatar';
import { getAudioUrl, deleteCast } from '../api/client';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../utils/alert';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius, elevation } from '../theme/space';

function timeAgo(dateString) {
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
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
    creator_avatar,
    sharer_name,
    sharer_avatar,
    participants,
    recipient_count,
    shared_with_me,
    played,
    created_at,
  } = cast;

  const [audioUrl, setAudioUrl] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const { track, stop } = usePlayer();

  const openDetail = () => router.push(`/cast/${id}`);

  // A cast left for you (you're a recipient, not the creator/sharer) that you
  // haven't listened to yet.
  const unheard = shared_with_me && !cast.can_manage && !played;

  // You're the assigned sharer (not the creator) and haven't sent it yet.
  const needsSharing =
    !!user && cast.sharer_id === user.id && cast.creator_id !== user.id && recipient_count === 0;

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
      onDeleted?.(id);
    } catch (err) {
      toast.error(err.message || 'Could not delete that cast.');
      setDeleting(false);
    }
  }

  // Gentle staggered fade-in-up as cards arrive.
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
        unheard && styles.cardUnheard,
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
            <View style={styles.bylineRow}>
              <Avatar
                name={shared_with_me ? sharer_name || creator_name : creator_name}
                path={shared_with_me ? sharer_avatar || creator_avatar : creator_avatar}
                size={18}
                style={styles.bylineAvatar}
              />
              <Text style={styles.byline} numberOfLines={1}>
                {shared_with_me ? `Shared by ${sharer_name || creator_name}` : creator_name} ·{' '}
                {timeAgo(created_at)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        {unheard ? <View style={styles.unheardDot} accessibilityLabel="Unheard" /> : null}
        {!shared_with_me ? (
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={deleting}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Delete cast"
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Ionicons name="trash-outline" size={18} color={colors.inkFaint} />
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
            color={colors.inkMuted}
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

      {needsSharing ? (
        <TouchableOpacity style={styles.nudge} onPress={openDetail} activeOpacity={0.7}>
          <Ionicons name="megaphone-outline" size={15} color={colors.emberInk} />
          <Text style={styles.nudgeText}>You’re the sharer — choose who hears this</Text>
        </TouchableOpacity>
      ) : !shared_with_me && recipient_count > 0 ? (
        <Text style={styles.sharedNote}>
          Shared with {recipient_count} {recipient_count === 1 ? 'person' : 'people'}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg + 4,
    marginHorizontal: space.lg,
    marginBottom: space.md + 2,
    ...elevation.rest,
  },
  cardUnheard: {
    backgroundColor: colors.accentSurface,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.md,
  },
  headerPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: space.md + 2,
  },
  unheardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ember,
    marginLeft: space.sm,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.xs,
  },
  title: {
    ...type.h3,
    color: colors.ink,
    marginBottom: space.xs,
  },
  bylineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bylineAvatar: {
    marginRight: space.xs + 2,
  },
  byline: {
    ...type.caption,
    color: colors.inkMuted,
    flex: 1,
  },
  summary: {
    ...type.bodySm,
    color: colors.inkSoft,
    marginBottom: space.md,
  },
  participantsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  participantsIcon: {
    marginRight: space.xs + 2,
  },
  participantTag: {
    backgroundColor: colors.surfaceSunk,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    marginRight: space.xs + 2,
    marginBottom: space.xs,
  },
  participantText: {
    ...type.caption,
    color: colors.emberInk,
    fontFamily: type.label.fontFamily,
  },
  player: {
    marginTop: space.xs,
  },
  sharedNote: {
    ...type.caption,
    color: colors.inkMuted,
    marginTop: space.sm,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.sm + 2,
    backgroundColor: colors.surfaceSunk,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  nudgeText: {
    ...type.caption,
    color: colors.emberInk,
    fontFamily: type.label.fontFamily,
    marginLeft: space.xs + 2,
  },
});
