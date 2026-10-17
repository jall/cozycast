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
import { timeAgo } from '../src/utils/time';
import { fonts } from '../src/theme/typography';
import { type } from '../src/theme/type';
import { radius, layout, space } from '../src/theme/space';

// What each kind of notification says, and its icon. (Written by DB triggers —
// see the notifications migrations.)
const KINDS = {
  comment: { icon: 'chatbubble-outline', text: (a, t) => `${a} commented on ${t}` },
  share: { icon: 'paper-plane-outline', text: (a, t) => `${a} shared ${t} with you` },
  tagged: { icon: 'people-outline', text: (a, t) => `${a} tagged you in ${t}` },
  sharer: {
    icon: 'hand-left-outline',
    text: (a, t) => `${a} asked you to choose who hears ${t}`,
  },
  heard: { icon: 'headset-outline', text: (a, t) => `${a} listened to ${t}` },
  ask: {
    icon: 'help-buoy-outline',
    text: (a, t, n) => `${a} asked you for a cast${n.prompt ? `: “${n.prompt}”` : ''}`,
  },
  answered: { icon: 'gift-outline', text: (a, t) => `${a} answered your ask with ${t}` },
  turn: { icon: 'swap-horizontal', text: (a, t) => `${a} passed you the mic on ${t}` },
  finished: {
    icon: 'checkmark-done-outline',
    text: (a, t) => `${a} finished ${t} — any of you can choose who hears it`,
  },
};

function describe(n) {
  const kind = KINDS[n.type];
  const title = `“${n.cast_title}”`;
  return kind ? kind.text(n.actor_name, title, n) : `${n.actor_name} on ${title}`;
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
          <Ionicons name="arrow-back" size={20} color={colors.emberInk} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Lately</Text>

        {loading ? (
          <ActivityIndicator color={colors.ember} style={{ marginTop: 32 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={32} color={colors.inkFaint} />
            <Text style={styles.emptyText}>Nothing yet — it’s calm in here.</Text>
            <Text style={styles.emptyHint}>
              You’ll hear here when someone shares a cast with you, tags you in one, asks you for
              one, passes you the mic, leaves a note, or listens to something you made.
            </Text>
          </View>
        ) : (
          items.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.row, !n.read && styles.rowUnread]}
              onPress={() => {
                // An ask is answered from Fireside; everything else opens its cast.
                if (n.type === 'ask') {
                  if (router.canDismiss()) router.dismissAll();
                  else router.replace('/');
                } else if (n.cast_id) router.push(`/cast/${n.cast_id}`);
              }}
              activeOpacity={0.7}
              testID="notification-row"
            >
              <Ionicons
                name={KINDS[n.type]?.icon || 'flame-outline'}
                size={18}
                color={colors.emberInk}
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
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backText: {
    ...type.label,
    fontSize: 15,
    color: colors.emberInk,
    marginLeft: space.xs,
  },
  title: {
    ...type.h1,
    color: colors.ink,
    marginBottom: space.lg,
  },
  empty: {
    alignItems: 'center',
    paddingTop: space['3xl'],
  },
  emptyHint: {
    ...type.bodySm,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 360,
    marginTop: space.sm,
  },
  emptyText: {
    ...type.bodySm,
    color: colors.inkMuted,
    marginTop: space.sm + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: space.md + 2,
    marginBottom: space.sm,
  },
  rowUnread: {
    backgroundColor: colors.accentSurface,
  },
  rowIcon: {
    marginRight: space.md,
  },
  rowText: {
    flex: 1,
  },
  rowBody: {
    ...type.bodySm,
    fontFamily: fonts.medium,
    color: colors.ink,
    lineHeight: 20,
  },
  rowTime: {
    ...type.caption,
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
