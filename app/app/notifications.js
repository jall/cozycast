import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getNotifications } from '../src/api/client';
import { useNotifications } from '../src/context/NotificationsContext';
import { fonts } from '../src/theme/typography';

function timeAgo(dateString) {
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

function describe(n) {
  const title = `“${n.cast_title}”`;
  if (n.type === 'comment') return `${n.actor_name} commented on ${title}`;
  if (n.type === 'share') return `${n.actor_name} shared ${title} with you`;
  return `${n.actor_name} did something on ${title}`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { markAllRead } = useNotifications();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  useEffect(() => {
    let active = true;
    getNotifications()
      .then((data) => {
        if (!active) return;
        setItems(data);
        // Opening the inbox clears the unread badge.
        if (data.some((n) => !n.read)) markAllRead();
      })
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [markAllRead]);

  return (
    <View style={styles.container} testID="notifications">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.6}>
          <Ionicons name="arrow-back" size={20} color={colors.ember} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Notifications</Text>

        {loading ? (
          <ActivityIndicator color={colors.ember} style={{ marginTop: 32 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={32} color={colors.inkFaint} />
            <Text style={styles.emptyText}>Nothing yet — it’s calm in here.</Text>
          </View>
        ) : (
          items.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.row, !n.read && styles.rowUnread]}
              onPress={() => n.cast_id && router.push(`/cast/${n.cast_id}`)}
              activeOpacity={0.7}
              testID="notification-row"
            >
              <Ionicons
                name={n.type === 'comment' ? 'chatbubble-outline' : 'paper-plane-outline'}
                size={18}
                color={colors.ember}
                style={styles.rowIcon}
              />
              <View style={styles.rowText}>
                <Text style={styles.rowBody}>{describe(n)}</Text>
                <Text style={styles.rowTime}>{timeAgo(n.created_at)}</Text>
              </View>
              {!n.read ? <View style={styles.dot} /> : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
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
    color: colors.ember,
    marginLeft: 4,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.ink,
    marginBottom: 16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  rowUnread: {
    backgroundColor: colors.accentSurface,
  },
  rowIcon: {
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  rowBody: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.ink,
    lineHeight: 20,
  },
  rowTime: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ember,
    marginLeft: 8,
  },
});
