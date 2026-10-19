import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import FlameMark from './FlameMark';
import Faces from './Faces';
import Sheet from './Sheet';
import InvitePanel from './InvitePanel';
import { getFriends } from '../api/client';
import { useNotifications } from '../context/NotificationsContext';
import { useShell } from '../context/ShellContext';
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

// The laptop/tablet rail, rendered by the root layout so it stays put on every
// route: wordmark, the places (Fireside · Voice notes · Notifications · You), the one loud
// action (Record a cast), and the faces around your fire. Replaces the phone's
// bottom tab bar from `layout.wide` up.
export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { tab, setTab, friendsVersion } = useShell();
  const { unreadCount, unheardNotes } = useNotifications();
  const [friends, setFriends] = useState([]);
  const [inviting, setInviting] = useState(false);
  const home = pathname === '/';

  useEffect(() => {
    let live = true;
    getFriends()
      .then((f) => live && setFriends(f || []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [friendsVersion]);

  function goTab(next) {
    setTab(next);
    if (home) return;
    // Back to the one home screen at the bottom of the stack — not a second
    // copy pushed on top.
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  }

  return (
    <View style={styles.rail}>
      <TouchableOpacity style={styles.brand} onPress={() => goTab('feed')} activeOpacity={0.8}>
        <FlameMark size={30} />
        <Text style={styles.wordmark}>cozycast</Text>
      </TouchableOpacity>

      <View style={styles.nav}>
        <NavItem
          icon="flame"
          label="Fireside"
          active={home && tab === 'feed'}
          onPress={() => goTab('feed')}
        />
        <NavItem
          icon="chatbubbles"
          label="Voice notes"
          count={unheardNotes}
          active={pathname?.startsWith('/notes')}
          onPress={() => router.navigate('/notes')}
          testID="nav-notes"
        />
        <NavItem
          icon="notifications"
          label="Notifications"
          count={unreadCount}
          active={pathname === '/notifications'}
          onPress={() => router.navigate('/notifications')}
          testID="notifications-bell"
        />
        <NavItem
          icon="person"
          label="You"
          active={home && tab === 'profile'}
          onPress={() => goTab('profile')}
        />
      </View>

      <TouchableOpacity
        style={[styles.cta, home && tab === 'record' && styles.ctaOn]}
        onPress={() => goTab('record')}
        activeOpacity={0.85}
        testID="nav-record"
      >
        <Ionicons name="mic" size={19} color={colors.onEmber} />
        <Text style={styles.ctaText}>Record a cast</Text>
      </TouchableOpacity>

      <View style={styles.circle}>
        <Text style={styles.circleTitle}>Around your fire</Text>
        {friends.length > 0 ? (
          <>
            <Faces
              people={friends.map((f) => ({ id: f.id, name: f.name || f.email }))}
              onPressPerson={(pid) => router.push(`/person/${pid}`)}
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
        <TouchableOpacity onPress={() => setInviting(true)} activeOpacity={0.7}>
          <Text style={styles.invite}>+ Invite someone</Text>
        </TouchableOpacity>
      </View>

      <Sheet
        visible={inviting}
        onClose={() => setInviting(false)}
        title="Invite someone"
        subtitle="Bring someone around your fire."
      >
        <InvitePanel />
      </Sheet>
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
  ctaOn: {
    backgroundColor: colors.emberSoft,
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
