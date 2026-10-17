import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { getFeed } from '../api/client';
import CastCard from '../components/CastCard';
import CastCover from '../components/CastCover';
import CastCardSkeleton from '../components/CastCardSkeleton';
import Avatar from '../components/Avatar';
import Campfire from '../components/Campfire';
import NightSky from '../components/NightSky';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { usePlayer } from '../context/PlayerContext';
import { trackFor } from '../utils/track';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius, elevation, layout } from '../theme/space';

function partOfDay(h = new Date().getHours()) {
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function eyebrow() {
  const d = new Date();
  return `${d.toLocaleDateString(undefined, { weekday: 'long' })} ${partOfDay(d.getHours())}`;
}

const FILTERS = [
  { key: 'all', label: 'Around the fire' },
  { key: 'new', label: 'New to you' },
  { key: 'mine', label: 'From you' },
  { key: 'share', label: 'Needs sharing' },
];

// Fireside — the home. A slice of night sky with the campfire, a greeting, the
// next unheard cast gently surfaced as "waiting for you", then everything
// else. Filters are quiet chips, not tabs-as-pressure.
export default function FeedScreen() {
  const [casts, setCasts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const router = useRouter();
  const { user } = useAuth();
  const { toggle, track, isPlaying } = usePlayer();
  const { unreadCount, refresh: refreshNotifications } = useNotifications();
  const { width } = useWindowDimensions();
  const wide = width >= layout.wide;
  const roomy = width >= 600;

  const fetchCasts = useCallback(async () => {
    try {
      setError(null);
      setCasts(await getFeed());
    } catch (err) {
      setError(err.message || 'Could not load your casts.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchCasts().finally(() => active && setLoading(false));
      refreshNotifications();
      return () => {
        active = false;
      };
    }, [fetchCasts, refreshNotifications]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await fetchCasts();
    setRefreshing(false);
  }

  const isUnheard = (c) => c.shared_with_me && !c.can_manage && !c.played;
  const needsSharing = (c) =>
    !!user && c.sharer_id === user.id && c.creator_id !== user.id && c.recipient_count === 0;

  // Casts left for you (you're a recipient, not the creator/sharer) that you
  // haven't listened to yet.
  const unheard = casts.filter(isUnheard);
  const waiting = filter === 'all' ? unheard[0] || null : null;
  const counts = {
    new: unheard.length,
    share: casts.filter(needsSharing).length,
  };
  let rest = waiting ? casts.filter((c) => c.id !== waiting.id) : casts;
  if (filter === 'new') rest = unheard;
  if (filter === 'mine') rest = casts.filter((c) => !c.shared_with_me);
  if (filter === 'share') rest = casts.filter(needsSharing);

  const firstName = (user?.name || '').trim().split(/\s+/)[0];
  const greeting = `Good ${partOfDay()}${firstName ? `, ${firstName}` : ''}.`;

  function hero(subline) {
    const fireWidth = wide ? 210 : roomy ? 160 : 112;
    return (
      <NightSky
        radius={roomy ? radius.lg : 0}
        groundColor={colors.bg}
        seed={user?.id || 'home'}
        style={[styles.hero, roomy && styles.heroRoomy]}
      >
        <View style={[styles.heroText, { paddingRight: fireWidth + (roomy ? 72 : 28) }]}>
          <Text style={styles.eyebrow}>{eyebrow()}</Text>
          <Text style={[styles.greeting, !roomy && styles.greetingSmall]}>{greeting}</Text>
          <Text style={styles.subline}>{subline}</Text>
        </View>
        <Campfire width={fireWidth} style={[styles.fire, !roomy && styles.fireSmall]} />
        {!wide ? (
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={styles.bell}
            accessibilityLabel="Notifications"
            testID="notifications-bell"
          >
            <Ionicons name="notifications-outline" size={21} color={colors.ink} />
            {/* A quiet dot, not a number — there's nothing to count in here. */}
            {unreadCount > 0 ? <View style={styles.badge} accessibilityLabel="Unread" /> : null}
          </TouchableOpacity>
        ) : null}
      </NightSky>
    );
  }

  function header() {
    const n = unheard.length;
    const subline =
      n > 0
        ? `${n === 1 ? 'A voice is' : `${n} voices are`} waiting by the fire. Only you and the people they chose can hear them.`
        : 'It’s quiet by the fire tonight, and that’s okay.';
    const waitingPlaying = waiting && track?.id === waiting.id && isPlaying;
    return (
      <View>
        {hero(subline)}

        {waiting ? (
          <TouchableOpacity
            style={styles.waiting}
            activeOpacity={0.85}
            onPress={() => router.push(`/cast/${waiting.id}`)}
            testID="waiting-cast"
          >
            <CastCover seed={waiting.id} title={waiting.title} size={roomy ? 76 : 60} />
            <View style={styles.waitingText}>
              <View style={styles.waitingFromRow}>
                <Avatar
                  name={waiting.sharer_name || waiting.creator_name}
                  path={waiting.sharer_avatar || waiting.creator_avatar}
                  size={18}
                  style={styles.waitingAvatar}
                />
                <Text style={styles.waitingFrom}>
                  left for you by {waiting.sharer_name || waiting.creator_name}
                </Text>
              </View>
              <Text style={styles.waitingTitle} numberOfLines={2}>
                {waiting.title}
              </Text>
            </View>
            {waiting.audio_path ? (
              <TouchableOpacity
                onPress={() => toggle(trackFor(waiting))}
                style={styles.waitingPlay}
                accessibilityLabel={`${waitingPlaying ? 'Pause' : 'Play'} ${waiting.title}`}
              >
                <Ionicons
                  name={waitingPlaying ? 'pause' : 'play'}
                  size={24}
                  color={colors.onEmber}
                  style={waitingPlaying ? null : { marginLeft: 3 }}
                />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        ) : null}

        <View style={styles.filters} accessibilityRole="tablist">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const count = counts[f.key];
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
                {count > 0 ? (
                  <View style={styles.chipCount}>
                    <Text style={styles.chipCountText}>{count}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  function renderEmpty() {
    if (loading || waiting) return null;
    if (filter !== 'all') {
      return <Text style={styles.filterEmpty}>Nothing here right now.</Text>;
    }
    return (
      <View style={styles.emptyCard}>
        <Campfire width={120} sparks={false} />
        <Text style={styles.emptyTitle}>It’s quiet here…</Text>
        <Text style={styles.emptyBody}>
          No casts yet. Record a little conversation and share it with someone, or wait for a friend
          to send one your way.
        </Text>
        <View style={styles.emptyHintRow}>
          <Ionicons name="mic" size={15} color={colors.inkMuted} />
          <Text style={styles.emptyHint}>Pull up a log and press Record to begin</Text>
        </View>
      </View>
    );
  }

  const column = [styles.column, { maxWidth: wide ? layout.feed : layout.column }];

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[column, styles.listContent]}>
          {hero('gathering your casts…')}
          <View style={styles.skeletons}>
            {[0, 1, 2].map((i) => (
              <CastCardSkeleton key={i} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchCasts} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={column}>
          <FlatList
            data={rest}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <View style={[styles.item, roomy && styles.itemRoomy]}>
                <CastCard cast={item} index={index} />
              </View>
            )}
            ListHeaderComponent={header}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.ember}
                colors={[colors.ember]}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  column: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  listContent: {
    paddingBottom: space['2xl'],
  },
  hero: {
    marginBottom: space.lg,
  },
  heroRoomy: {
    marginHorizontal: space.xl,
    marginTop: space.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  heroText: {
    paddingLeft: space.xl,
    paddingTop: space['2xl'] - 4,
    paddingBottom: 60,
    minHeight: 200,
  },
  eyebrow: {
    ...type.monoLabel,
    color: colors.emberSoft,
    marginBottom: space.sm,
  },
  greeting: {
    ...type.moment,
    color: colors.ink,
  },
  greetingSmall: {
    fontSize: 30,
    lineHeight: 34,
  },
  subline: {
    ...type.bodySm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    marginTop: space.sm,
  },
  fire: {
    position: 'absolute',
    right: space['3xl'],
    bottom: 4,
  },
  fireSmall: {
    right: space.md,
    bottom: 14,
  },
  bell: {
    position: 'absolute',
    top: space.lg,
    right: space.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 234, 219, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.ember,
    borderWidth: 1.5,
    borderColor: '#1A1526',
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: '#6B3A28',
    borderRadius: radius.md,
    padding: space.md + 2,
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    ...elevation.glow,
    shadowOpacity: 0.15,
  },
  waitingText: {
    flex: 1,
    marginHorizontal: space.md + 2,
  },
  waitingFromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.xs + 2,
  },
  waitingAvatar: {
    marginRight: space.xs + 2,
  },
  waitingFrom: {
    ...type.eyebrow,
    color: colors.emberInk,
  },
  waitingTitle: {
    ...type.h2,
    color: colors.ink,
  },
  waitingPlay: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.glow,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: space.lg,
    marginBottom: space.md + 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: space.lg - 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.smoke,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  chipOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    ...type.label,
    fontFamily: type.h3.fontFamily,
    color: colors.inkSoft,
  },
  chipTextOn: {
    color: colors.onEmber,
  },
  chipCount: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.sm,
  },
  chipCountText: {
    fontFamily: type.wordmark.fontFamily,
    fontSize: 11,
    color: colors.onEmber,
  },
  item: {
    paddingHorizontal: space.lg,
  },
  itemRoomy: {
    paddingHorizontal: space.xl,
  },
  skeletons: {
    paddingHorizontal: space.lg,
  },
  filterEmpty: {
    ...type.bodySm,
    color: colors.inkMuted,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 28,
    paddingVertical: space['2xl'],
    alignItems: 'center',
    marginHorizontal: space.xl,
    marginTop: space.lg,
  },
  emptyTitle: {
    ...type.h2,
    color: colors.ink,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  emptyBody: {
    ...type.body,
    fontSize: 15,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  emptyHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  emptyHint: {
    ...type.label,
    color: colors.inkMuted,
    marginLeft: space.xs + 2,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['2xl'],
  },
  errorText: {
    ...type.bodySm,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: space.lg,
  },
  retryButton: {
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  retryText: {
    ...type.h3,
    color: colors.onEmber,
  },
});
