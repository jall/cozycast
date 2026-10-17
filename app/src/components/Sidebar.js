import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import FlameMark from './FlameMark';
import Faces from './Faces';
import { getFriends } from '../api/client';
import { useNotifications } from '../context/NotificationsContext';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius, layout, elevation } from '../theme/space';

function NavItem({ icon, label, active, onPress, count, testID }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.item, hovered && styles.itemHover, active && styles.itemActive]}
      accessibilityRole="link"
      accessibilityState={{ selected: !!active }}
      testID={testID}
    >
      <Ionicons
        name={active ? icon : `${icon}-outline`}
        size={22}
        color={active ? colors.emberInk : colors.inkSoft}
      />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {count > 0 ? (
        <View style={styles.count}>
          <Text style={styles.countText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// The laptop/tablet rail: wordmark, the three places, the one loud action
// ("Pull up a log" → Record), and the faces around your fire. Replaces the
// phone's bottom tab bar from `layout.wide` up.
export default function Sidebar({ active, onNavigate }) {
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    let live = true;
    getFriends()
      .then((f) => live && setFriends(f || []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <View style={styles.rail}>
      <View style={styles.brand}>
        <FlameMark size={30} />
        <Text style={styles.wordmark}>cozycast</Text>
      </View>

      <View style={styles.nav}>
        <NavItem
          icon="flame"
          label="Fireside"
          active={active === 'feed'}
          onPress={() => onNavigate('feed')}
        />
        <NavItem
          icon="mic"
          label="Record"
          active={active === 'record'}
          onPress={() => onNavigate('record')}
        />
        <NavItem
          icon="notifications"
          label="Notifications"
          count={unreadCount}
          onPress={() => router.push('/notifications')}
          testID="notifications-bell"
        />
        <NavItem
          icon="person"
          label="You"
          active={active === 'profile'}
          onPress={() => onNavigate('profile')}
        />
      </View>

      <TouchableOpacity
        style={styles.cta}
        onPress={() => onNavigate('record')}
        activeOpacity={0.85}
        accessibilityLabel="Pull up a log — record a cast"
      >
        <Ionicons name="mic" size={19} color={colors.onEmber} />
        <Text style={styles.ctaText}>Pull up a log</Text>
      </TouchableOpacity>

      <View style={styles.circle}>
        <Text style={styles.circleTitle}>Around your fire</Text>
        {friends.length > 0 ? (
          <>
            <Faces
              names={friends.map((f) => f.name || f.email)}
              size={30}
              max={6}
              ringColor={colors.surfaceSunk}
            />
            <Text style={styles.circleNote}>
              {friends.length} {friends.length === 1 ? 'person' : 'people'} you can share with
            </Text>
          </>
        ) : (
          <Text style={styles.circleNote}>Nobody yet — invite the people you’d talk to late.</Text>
        )}
        <TouchableOpacity onPress={() => onNavigate('profile')} activeOpacity={0.7}>
          <Text style={styles.invite}>+ Invite someone</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: layout.rail,
    backgroundColor: '#15121C',
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
    paddingHorizontal: space.lg + 4,
    paddingVertical: space['2xl'] - 4,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    marginBottom: space['2xl'] - 4,
  },
  wordmark: {
    ...type.wordmark,
    color: colors.ink,
    marginLeft: space.sm + 2,
  },
  nav: {
    marginBottom: space.xl + 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: space.md,
    borderRadius: 14,
    marginBottom: space.xs,
  },
  itemHover: {
    backgroundColor: colors.surface,
  },
  itemActive: {
    backgroundColor: colors.accentSurface,
  },
  label: {
    ...type.bodySm,
    fontSize: 15,
    fontFamily: type.label.fontFamily,
    color: colors.inkSoft,
    marginLeft: space.md,
    flex: 1,
  },
  labelActive: {
    fontFamily: type.h3.fontFamily,
    color: colors.emberInk,
  },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontFamily: type.wordmark.fontFamily,
    fontSize: 12,
    color: colors.onEmber,
  },
  cta: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.ember,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.glow,
    shadowOpacity: 0.35,
  },
  ctaText: {
    ...type.h3,
    fontSize: 15,
    color: colors.onEmber,
    marginLeft: space.sm + 2,
  },
  circle: {
    marginTop: 'auto',
    padding: space.lg + 2,
    borderRadius: 18,
    backgroundColor: colors.surfaceSunk,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  circleTitle: {
    fontFamily: type.moment.fontFamily,
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
    marginBottom: space.md,
  },
  circleNote: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkMuted,
    marginTop: space.sm + 2,
  },
  invite: {
    ...type.label,
    fontFamily: type.h3.fontFamily,
    color: colors.emberInk,
    marginTop: space.md,
  },
});
