import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { getFeed } from '../api/client';
import CastCard from '../components/CastCard';
import CastCover from '../components/CastCover';
import CastCardSkeleton from '../components/CastCardSkeleton';
import { useNotifications } from '../context/NotificationsContext';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius, elevation } from '../theme/space';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'good morning';
  if (h < 18) return 'good afternoon';
  return 'good evening';
}

// The calm home: a quiet greeting, the next unheard cast gently surfaced as
// "waiting for you", then everything else. No "feed", no scroll-first energy.
export default function FeedScreen() {
  const [casts, setCasts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { unreadCount, refresh: refreshNotifications } = useNotifications();

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

  const handleDeleted = useCallback((castId) => {
    setCasts((prev) => prev.filter((c) => c.id !== castId));
  }, []);

  // Casts left for you (you're a recipient, not the creator/sharer) that you
  // haven't listened to yet.
  const unheard = casts.filter((c) => c.shared_with_me && !c.can_manage && !c.played);
  const waiting = unheard[0] || null;
  const rest = waiting ? casts.filter((c) => c.id !== waiting.id) : casts;

  function header() {
    const n = unheard.length;
    const subline =
      n > 0
        ? `${n === 1 ? 'a voice' : `${n} voices`} waiting for you`
        : "it's quiet, and that's okay.";
    return (
      <View>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.subline}>{subline}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={styles.bell}
            accessibilityLabel="Notifications"
            testID="notifications-bell"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.inkMuted} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {waiting ? (
          <TouchableOpacity
            style={styles.waiting}
            activeOpacity={0.85}
            onPress={() => router.push(`/cast/${waiting.id}`)}
            testID="waiting-cast"
          >
            <CastCover seed={waiting.id} title={waiting.title} size={64} />
            <View style={styles.waitingText}>
              <Text style={styles.waitingFrom}>
                left for you by {waiting.sharer_name || waiting.creator_name}
              </Text>
              <Text style={styles.waitingTitle} numberOfLines={2}>
                {waiting.title}
              </Text>
            </View>
            <Ionicons name="play-circle" size={34} color={colors.ember} />
          </TouchableOpacity>
        ) : null}

        {rest.length > 0 ? <Text style={styles.eyebrow}>lately</Text> : null}
      </View>
    );
  }

  function renderEmpty() {
    if (loading || waiting) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="cafe-outline" size={40} color={colors.ember} />
          </View>
          <Text style={styles.emptyTitle}>It's quiet here…</Text>
          <Text style={styles.emptyBody}>
            No casts yet. Record a little conversation and share it with someone, or wait for a
            friend to send one your way.
          </Text>
          <View style={styles.emptyHintRow}>
            <Ionicons name="mic" size={15} color={colors.inkMuted} />
            <Text style={styles.emptyHint}>Tap Record below to begin</Text>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonList}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>{greeting()}</Text>
            </View>
          </View>
          {[0, 1, 2].map((i) => (
            <CastCardSkeleton key={i} />
          ))}
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
        <FlatList
          data={rest}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <CastCard cast={item} index={index} onDeleted={handleDeleted} />
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: 56,
    paddingBottom: space.md,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    ...type.h1,
    color: colors.ink,
  },
  subline: {
    ...type.bodySm,
    color: colors.inkMuted,
    marginTop: space.xs,
  },
  bell: {
    padding: space.xs,
    marginTop: space.xs,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.onEmber,
    fontSize: 11,
    fontFamily: type.h3.fontFamily,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSurface,
    borderRadius: radius.md,
    padding: space.lg,
    marginHorizontal: space.lg,
    marginBottom: space.lg,
  },
  waitingText: {
    flex: 1,
    marginHorizontal: space.md,
  },
  waitingFrom: {
    ...type.eyebrow,
    color: colors.emberInk,
    marginBottom: space.xs,
  },
  waitingTitle: {
    ...type.h2,
    color: colors.ink,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.inkMuted,
    marginHorizontal: space.xl,
    marginBottom: space.sm,
  },
  listContent: {
    paddingTop: space.sm,
    paddingBottom: space.xl,
  },
  skeletonList: {
    paddingTop: space.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space['2xl'],
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 28,
    paddingVertical: space['2xl'],
    alignItems: 'center',
    alignSelf: 'stretch',
    ...elevation.rest,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    ...type.h2,
    color: colors.ink,
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
    borderRadius: radius.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  retryText: {
    ...type.h3,
    color: colors.onEmber,
  },
});
