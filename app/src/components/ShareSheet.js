import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sheet from './Sheet';
import Avatar from './Avatar';
import InvitePanel from './InvitePanel';
import { getFriends, getRecipients, shareCast, removeRecipient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useShell } from '../context/ShellContext';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius } from '../theme/space';

// "Who gathers round?" — choose who hears a cast without leaving where you
// are. Each tap shares (or un-shares) straight away. With nobody in your
// address book yet, it offers an invite link right here instead of sending you
// off to your profile. `onChange(count)` reports the new number of recipients.
export default function ShareSheet({ cast, visible, onClose, onChange }) {
  const toast = useToast();
  const { friendsVersion } = useShell();
  const [friends, setFriends] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);

  const castId = cast?.id;
  useEffect(() => {
    if (!visible || !castId) return undefined;
    let live = true;
    setLoading(true);
    Promise.all([getFriends().catch(() => []), getRecipients(castId).catch(() => [])])
      .then(([f, r]) => {
        if (!live) return;
        setFriends(f || []);
        setRecipients(r || []);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [visible, castId, friendsVersion]);

  const chosen = new Set(recipients.map((r) => r.id));

  async function toggle(friend) {
    const has = chosen.has(friend.id);
    const prev = recipients;
    const next = has ? recipients.filter((r) => r.id !== friend.id) : [...recipients, friend];
    setRecipients(next);
    onChange?.(next.length);
    try {
      if (has) await removeRecipient(castId, friend.id);
      else await shareCast(castId, [friend.id]);
    } catch (err) {
      setRecipients(prev);
      onChange?.(prev.length);
      toast.error(err.message || 'Could not update who this is shared with.');
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Who gathers round?"
      subtitle={cast ? `“${cast.title}” — only the people you pick can hear it.` : null}
      testID="share-sheet"
    >
      {loading ? (
        <ActivityIndicator color={colors.ember} style={styles.loading} />
      ) : friends.length === 0 ? (
        <View>
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={22} color={colors.emberInk} />
            <Text style={styles.emptyText}>
              Nobody’s around your fire yet. Invite someone, and once they’ve joined you can share
              this with them.
            </Text>
          </View>
          <InvitePanel compact />
        </View>
      ) : (
        <View>
          {friends.map((f) => {
            const on = chosen.has(f.id);
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.row, on && styles.rowOn]}
                onPress={() => toggle(f)}
                activeOpacity={0.75}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Avatar name={f.name} path={f.avatar_path} size={36} />
                <View style={styles.info}>
                  <Text style={styles.name}>{f.name}</Text>
                  {f.email ? <Text style={styles.email}>{f.email}</Text> : null}
                </View>
                <Ionicons
                  name={on ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={on ? colors.ember : colors.inkFaint}
                />
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.done} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.doneText}>
              {recipients.length > 0
                ? `Done — shared with ${recipients.length} ${
                    recipients.length === 1 ? 'person' : 'people'
                  }`
                : 'Done'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginVertical: space['2xl'],
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: space.lg,
  },
  emptyText: {
    ...type.bodySm,
    color: colors.inkSoft,
    flex: 1,
    marginLeft: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.sm,
    marginBottom: space.xs,
  },
  rowOn: {
    backgroundColor: colors.accentSurface,
  },
  info: {
    flex: 1,
    marginHorizontal: space.md,
  },
  name: {
    ...type.label,
    fontSize: 15,
    color: colors.ink,
  },
  email: {
    ...type.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  done: {
    marginTop: space.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    ...type.h3,
    color: colors.onEmber,
  },
});
