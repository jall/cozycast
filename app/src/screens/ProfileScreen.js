import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getFriends,
  generateInvite as genInvite,
  getPendingInvites,
  uploadAvatar,
} from '../api/client';
import { showAlert } from '../utils/alert';
import { type } from '../theme/type';
import { radius, elevation, layout, space } from '../theme/space';
import Avatar from '../components/Avatar';
import PressableScale from '../components/PressableScale';

export default function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const toast = useToast();
  const [friends, setFriends] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoadingFriends(true);
    try {
      const [friendsData, invitesData] = await Promise.all([
        getFriends().catch(() => []),
        getPendingInvites().catch(() => []),
      ]);
      setFriends(friendsData);
      setInvites(invitesData);
    } catch {
      // Silently handle — lists just stay empty
    } finally {
      setLoadingFriends(false);
    }
  }

  async function handleGenerateInvite() {
    setGeneratingInvite(true);
    try {
      const code = await genInvite();
      if (code) {
        // Show the new code first — it's saved regardless of whether the
        // clipboard copy works (it can reject in some browsers/contexts), so
        // never let a failed copy hide a successfully-created invite.
        const newInvites = await getPendingInvites();
        setInvites(newInvites);
        let copied = false;
        try {
          await Clipboard.setStringAsync(code);
          copied = true;
        } catch {
          // Non-fatal — the code is listed above and tappable to copy.
        }
        toast.success(
          copied
            ? `Invite ${code} copied — share it with someone special 🌱`
            : `Invite ${code} created — tap it to copy 🌱`,
        );
      }
    } catch (err) {
      toast.error(err.message || 'Could not generate an invite code.');
    } finally {
      setGeneratingInvite(false);
    }
  }

  async function handleCopyCode(code) {
    await Clipboard.setStringAsync(code);
    toast.success('Copied to clipboard');
  }

  async function handlePickAvatar() {
    if (uploadingAvatar) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.error('Photo access is needed to set a picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploadingAvatar(true);
      await uploadAvatar(asset.uri, asset.mimeType);
      await refreshProfile();
      toast.success('Picture updated ✨');
    } catch (err) {
      toast.error(err.message || 'Could not update your picture.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleLogout() {
    showAlert('Log out', 'Ready to step out for now?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={handlePickAvatar}
          activeOpacity={0.8}
          disabled={uploadingAvatar}
          accessibilityLabel="Change your profile picture"
          testID="change-avatar"
        >
          <Avatar name={user?.name} path={user?.avatar_path} size={88} />
          <View style={styles.avatarBadge}>
            {uploadingAvatar ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="camera" size={15} color={colors.white} />
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{user?.name || 'You'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      {/* Friends section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your people</Text>
        {loadingFriends ? (
          <ActivityIndicator color={colors.ember} style={{ marginTop: 12 }} />
        ) : friends.length === 0 ? (
          <View style={styles.emptySection}>
            <Ionicons name="people-outline" size={32} color={colors.inkFaint} />
            <Text style={styles.emptyText}>
              No one here yet — share an invite and bring someone in.
            </Text>
          </View>
        ) : (
          <View style={styles.friendsList}>
            {friends.map((friend, index) => (
              <View key={friend._id || friend.id || index} style={styles.friendRow}>
                <Avatar
                  name={friend.name}
                  path={friend.avatar_path}
                  size={40}
                  style={styles.friendAvatar}
                />
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  {friend.email && <Text style={styles.friendEmail}>{friend.email}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Invites section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invites</Text>

        <PressableScale
          style={[styles.generateButton, generatingInvite && styles.generateDisabled]}
          onPress={handleGenerateInvite}
          disabled={generatingInvite}
        >
          {generatingInvite ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color={colors.white} />
              <Text style={styles.generateText}>Share an invite</Text>
            </>
          )}
        </PressableScale>

        {invites.length > 0 && (
          <View style={styles.invitesList}>
            {invites.map((invite, index) => {
              const code =
                typeof invite === 'string' ? invite : invite.code || invite.inviteCode || '';
              const used = typeof invite === 'object' ? invite.used || invite.redeemed : false;
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.inviteRow}
                  onPress={() => handleCopyCode(code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.inviteInfo}>
                    <Text style={[styles.inviteCode, used && styles.inviteUsed]}>{code}</Text>
                    <Text style={styles.inviteStatus}>{used ? 'Used' : 'Pending'}</Text>
                  </View>
                  <Ionicons name="copy-outline" size={18} color={colors.inkMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop: 64,
    paddingBottom: 32,
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
  },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  avatarWrap: {
    marginBottom: 16,
    shadowColor: colors.emberSoft,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  userName: {
    ...type.h1,
    fontSize: 24,
    lineHeight: 30,
    color: colors.ink,
    marginBottom: space.xs,
  },
  userEmail: {
    ...type.bodySm,
    color: colors.inkMuted,
  },

  // Sections
  section: {
    paddingHorizontal: space.xl,
    marginBottom: 28,
  },
  sectionTitle: {
    ...type.h2,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
    marginBottom: space.md + 2,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    ...elevation.rest,
  },
  emptyText: {
    ...type.bodySm,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: space.sm + 2,
  },

  // Friends
  friendsList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...elevation.rest,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  friendAvatar: {
    marginRight: 14,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    ...type.label,
    fontSize: 15,
    color: colors.ink,
  },
  friendEmail: {
    ...type.caption,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 2,
  },

  // Invites
  generateButton: {
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingVertical: space.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.raised,
  },
  generateDisabled: {
    opacity: 0.7,
  },
  generateText: {
    ...type.h3,
    color: colors.onEmber,
    marginLeft: space.sm,
  },
  invitesList: {
    marginTop: space.md + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...elevation.rest,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  inviteInfo: {
    flex: 1,
    marginRight: 12,
  },
  inviteCode: {
    fontSize: 15,
    color: colors.ink,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inviteUsed: {
    color: colors.inkMuted,
    textDecorationLine: 'line-through',
  },
  inviteStatus: {
    ...type.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: space.xl,
    paddingVertical: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  logoutText: {
    ...type.label,
    fontSize: 16,
    color: colors.danger,
    marginLeft: space.sm,
  },

  bottomSpacer: {
    height: 24,
  },
});
