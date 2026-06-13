import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AudioPlayer from './AudioPlayer';
import { getAudioUrl } from '../api/client';

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

function getInitial(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export default function CastCard({ cast }) {
  const {
    title,
    description,
    creator_name,
    participants,
    created_at,
    id,
  } = cast;

  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    if (cast.audio_path) getAudioUrl(cast.audio_path).then(setAudioUrl);
  }, [cast.audio_path]);

  let participantList = [];
  if (Array.isArray(participants)) {
    participantList = participants;
  } else if (typeof participants === 'string' && participants) {
    try { participantList = JSON.parse(participants); } catch { participantList = [participants]; }
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitial(creator_name)}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.creatorName}>{creator_name || 'Someone'}</Text>
          <Text style={styles.timeAgo}>{timeAgo(created_at)}</Text>
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>

      {description ? (
        <Text style={styles.description} numberOfLines={3}>
          {description}
        </Text>
      ) : null}

      {participantList.length > 0 && (
        <View style={styles.participantsRow}>
          {participantList.map((p, i) => (
            <View key={i} style={styles.participantTag}>
              <Text style={styles.participantText}>
                {typeof p === 'string' ? p : p.name || 'Guest'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {audioUrl && <AudioPlayer uri={audioUrl} style={styles.player} />}
    </View>
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4A261',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  meta: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creatorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D2D2D',
  },
  timeAgo: {
    fontSize: 13,
    color: '#A89888',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#6B5E50',
    lineHeight: 20,
    marginBottom: 10,
  },
  participantsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
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
    fontWeight: '500',
  },
  player: {
    marginTop: 4,
  },
});
