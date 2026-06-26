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
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getFriends, generateInvite as genInvite, getPendingInvites } from '../api/client';
import { showAlert } from '../utils/alert';
import { fonts } from '../theme/typography';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [friends, setFriends] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [generatingInvite, setGeneratingInvite] = useState(false);

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

  function handleLogout() {
    showAlert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  }

  function getInitial(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{getInitial(user?.name)}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'You'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      {/* Friends section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friends</Text>
        {loadingFriends ? (
          <ActivityIndicator color="#E8734A" style={{ marginTop: 12 }} />
        ) : friends.length === 0 ? (
          <View style={styles.emptySection}>
            <Ionicons name="people-outline" size={32} color="#D4C5B5" />
            <Text style={styles.emptyText}>No friends yet. Share an invite code to connect!</Text>
          </View>
        ) : (
          <View style={styles.friendsList}>
            {friends.map((friend, index) => (
              <View key={friend._id || friend.id || index} style={styles.friendRow}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendAvatarText}>{getInitial(friend.name)}</Text>
                </View>
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

        <TouchableOpacity
          style={[styles.generateButton, generatingInvite && styles.generateDisabled]}
          onPress={handleGenerateInvite}
          disabled={generatingInvite}
          activeOpacity={0.8}
        >
          {generatingInvite ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.generateText}>Generate Invite</Text>
            </>
          )}
        </TouchableOpacity>

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
                  <Ionicons name="copy-outline" size={18} color="#A89888" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={20} color="#C0392B" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  content: {
    paddingTop: 64,
    paddingBottom: 32,
  },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F4A261',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#F4A261',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarLargeText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontFamily: fonts.bold,
  },
  userName: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#8C7B6B',
  },

  // Sections
  section: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
    marginBottom: 14,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#A89888',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },

  // Friends
  friendsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EFE8',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8734A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  friendAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#2D2D2D',
  },
  friendEmail: {
    fontSize: 13,
    color: '#A89888',
    marginTop: 2,
  },

  // Invites
  generateButton: {
    backgroundColor: '#E8734A',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E8734A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  generateDisabled: {
    opacity: 0.7,
  },
  generateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fonts.bold,
    marginLeft: 8,
  },
  invitesList: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EFE8',
  },
  inviteInfo: {
    flex: 1,
    marginRight: 12,
  },
  inviteCode: {
    fontSize: 15,
    color: '#2D2D2D',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inviteUsed: {
    color: '#A89888',
    textDecorationLine: 'line-through',
  },
  inviteStatus: {
    fontSize: 12,
    color: '#A89888',
    marginTop: 2,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0E6DA',
  },
  logoutText: {
    color: '#C0392B',
    fontSize: 16,
    fontFamily: fonts.medium,
    marginLeft: 8,
  },

  bottomSpacer: {
    height: 24,
  },
});
