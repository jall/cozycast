import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import PressableScale from './PressableScale';
import { generateInvite } from '../api/client';
import { useToast } from '../context/ToastContext';
import { inviteLink, shareOrCopy } from '../utils/invites';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius } from '../theme/space';

// Make an invite link and hand it over: copy it, or share it with the phone's
// share sheet. Each link connects one person, once. `onCreated(code)` lets a
// parent refresh its list of open invites.
export default function InvitePanel({ onCreated, compact = false }) {
  const toast = useToast();
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const code = await generateInvite();
      const url = inviteLink(code);
      setLink(url);
      onCreated?.(code);
      const how = await shareOrCopy(url, {
        title: 'Join me on cozycast',
        text: 'Pull up a seat by the fire — join me on cozycast:',
        copy: (u) => Clipboard.setStringAsync(u),
      });
      if (how === 'copied') toast.success('Invite link copied — send it to someone you trust.');
      else if (how !== 'shared') toast.success('Invite link created — copy it below.');
    } catch (err) {
      toast.error(err.message || 'Could not create an invite link.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await Clipboard.setStringAsync(link);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy — select the link and copy it by hand.');
    }
  }

  return (
    <View>
      {!compact ? (
        <Text style={styles.explain}>
          Send someone a link. When they open it and join (or log in), you’ll each be in the other’s
          address book — so you can choose to share casts with each other. Nothing is shared
          automatically.
        </Text>
      ) : null}

      {link ? (
        <View style={styles.linkBox}>
          <Text style={styles.link} selectable numberOfLines={1}>
            {link}
          </Text>
          <TouchableOpacity onPress={copy} style={styles.copy} accessibilityLabel="Copy link">
            <Ionicons name="copy-outline" size={17} color={colors.ink} />
            <Text style={styles.copyText}>Copy</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <PressableScale
        style={[styles.button, busy && styles.buttonBusy]}
        onPress={create}
        disabled={busy}
        testID="create-invite"
      >
        {busy ? (
          <ActivityIndicator color={colors.onEmber} size="small" />
        ) : (
          <>
            <Ionicons name="link" size={19} color={colors.onEmber} />
            <Text style={styles.buttonText}>
              {link ? 'Make another link' : 'Create an invite link'}
            </Text>
          </>
        )}
      </PressableScale>
      <Text style={styles.note}>Each link connects one person.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  explain: {
    ...type.bodySm,
    color: colors.inkSoft,
    marginBottom: space.lg,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSunk,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    paddingLeft: space.md,
    marginBottom: space.md,
  },
  link: {
    ...type.time,
    color: colors.emberInk,
    flex: 1,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  copyText: {
    ...type.label,
    color: colors.ink,
    marginLeft: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.ember,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonText: {
    ...type.h3,
    color: colors.onEmber,
    marginLeft: space.sm,
  },
  note: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: space.sm,
  },
});
