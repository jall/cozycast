import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
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
import { getCast, getAudioUrl, getRecipients, deleteCast } from '../../src/api/client';
import { usePlayer } from '../../src/context/PlayerContext';
import { useToast } from '../../src/context/ToastContext';
import { showAlert } from '../../src/utils/alert';
import { fonts } from '../../src/theme/typography';

function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
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
      })
      .catch(() => active && setCast(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

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
