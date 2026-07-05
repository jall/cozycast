import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AudioPlayer from './AudioPlayer';
import CastCover from './CastCover';
import Avatar from './Avatar';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../utils/time';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius, elevation } from '../theme/space';

export default function CastCard({ cast, index = 0 }) {
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

  const router = useRouter();
  const { user } = useAuth();

  const openDetail = () => router.push(`/cast/${id}`);

  // A cast left for you (you're a recipient, not the creator/sharer) that you
  // haven't listened to yet.
  const unheard = shared_with_me && !cast.can_manage && !played;

  // You're the assigned sharer (not the creator) and haven't sent it yet.
  const needsSharing =
    !!user && cast.sharer_id === user.id && cast.creator_id !== user.id && recipient_count === 0;

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

      {cast.audio_path && (
        <AudioPlayer
          audioPath={cast.audio_path}
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
        <Text style={styles.sharedNote}>Shared — only with the people you chose</Text>
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
