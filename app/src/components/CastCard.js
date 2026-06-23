import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AudioPlayer from './AudioPlayer';
import CastCover from './CastCover';
import { getAudioUrl } from '../api/client';
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

export default function CastCard({ cast, index = 0 }) {
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
      </View>

      {body ? (
        <Text style={styles.summary} numberOfLines={4}>
          {body}
        </Text>
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
  headerText: {
    flex: 1,
    marginLeft: 14,
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
