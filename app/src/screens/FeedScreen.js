import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getFeed } from '../api/client';
import CastCard from '../components/CastCard';
import CastCardSkeleton from '../components/CastCardSkeleton';
import { fonts } from '../theme/typography';

export default function FeedScreen() {
  const [casts, setCasts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCasts = useCallback(async () => {
    try {
      setError(null);
      const casts = await getFeed();
      setCasts(casts);
    } catch (err) {
      setError(err.message || 'Could not load your feed.');
    }
  }, []);

  // Refetch whenever the feed regains focus — on first mount, and on returning
  // from the cast detail page (so a cast deleted there disappears, and a freshly
  // recorded one shows up, without a manual pull-to-refresh).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchCasts().finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [fetchCasts]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await fetchCasts();
    setRefreshing(false);
  }

  const handleDeleted = useCallback((castId) => {
    setCasts((prev) => prev.filter((c) => c.id !== castId));
  }, []);

  function renderHeader() {
    // Profile lives in the bottom tab bar; the feed header is just the wordmark.
    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>cozycast</Text>
      </View>
    );
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="cafe-outline" size={40} color="#E8734A" />
          </View>
          <Text style={styles.emptyTitle}>It's quiet here…</Text>
          <Text style={styles.emptyBody}>
            No casts yet. Record a little conversation and share it with someone, or wait for a
            friend to send one your way.
          </Text>
          <View style={styles.emptyHintRow}>
            <Ionicons name="mic" size={15} color="#A89888" />
            <Text style={styles.emptyHint}>Tap Record below to begin</Text>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((i) => (
            <CastCardSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchCasts} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={casts}
          keyExtractor={(item) => item._id || item.id || String(Math.random())}
          renderItem={({ item, index }) => (
            <CastCard cast={item} index={index} onDeleted={handleDeleted} />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#E8734A"
              colors={['#E8734A']}
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
    backgroundColor: '#FFF8F0',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#FFF8F0',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: '#E8734A',
    letterSpacing: -0.5,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  skeletonList: {
    paddingTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 32,
    alignItems: 'center',
    alignSelf: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FCEDE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
    marginBottom: 10,
  },
  emptyBody: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#8C7B6B',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#A89888',
    marginLeft: 6,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 15,
    color: '#C0392B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#E8734A',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
