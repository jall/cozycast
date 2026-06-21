import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFeed } from '../api/client';
import CastCard from '../components/CastCard';

export default function FeedScreen({ navigation }) {
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

  useEffect(() => {
    fetchCasts().finally(() => setLoading(false));
  }, [fetchCasts]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchCasts();
    setRefreshing(false);
  }

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>cozycast</Text>
        <TouchableOpacity onPress={() => navigation?.navigate?.('Profile')} activeOpacity={0.7}>
          <Ionicons name="person-circle-outline" size={32} color="#2D2D2D" />
        </TouchableOpacity>
      </View>
    );
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color="#E8C9B0" />
        <Text style={styles.emptyTitle}>It's quiet here...</Text>
        <Text style={styles.emptyBody}>
          Record a cast and share it with someone, or wait for a friend to send one your way. Your
          cozy corner of the internet awaits.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E8734A" />
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
          renderItem={({ item }) => <CastCard cast={item} />}
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
    fontWeight: '700',
    color: '#E8734A',
    letterSpacing: -0.5,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D2D2D',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyBody: {
    fontSize: 15,
    color: '#8C7B6B',
    textAlign: 'center',
    lineHeight: 22,
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
