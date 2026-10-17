import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Sheet from './Sheet';
import { askForCast } from '../api/client';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius } from '../theme/space';

// A few ways in, for when a blank box is too much.
const STARTERS = [
  'Tell me about a smell that takes you straight back somewhere.',
  'What’s something you’ve changed your mind about lately?',
  'Tell me the story behind something you own.',
  'What did a normal Sunday look like when you were small?',
];

// "Ask <name> for a cast" — a prompt they can answer by recording. It lands on
// their Fireside and in their notifications; the cast they make comes to you.
export default function AskSheet({ person, visible, onClose, onAsked }) {
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const first = (person?.name || 'them').split(/\s+/)[0];

  async function send() {
    setSending(true);
    try {
      const req = await askForCast(person.id, prompt);
      toast.success(`Asked ${first} — you’ll hear when they answer.`);
      setPrompt('');
      onAsked?.(req);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Could not send that.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Ask ${first} for a cast`}
      subtitle="What would you love to hear them talk about? They answer by recording one, just for you."
      testID="ask-sheet"
    >
      <TextInput
        style={styles.input}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Tell me about…"
        placeholderTextColor={colors.inkFaint}
        multiline
        maxLength={500}
        autoFocus
        testID="ask-prompt"
      />
      <Text style={styles.startersLabel}>Or start from one of these</Text>
      {STARTERS.map((s) => (
        <TouchableOpacity key={s} onPress={() => setPrompt(s)} style={styles.starter}>
          <Text style={styles.starterText}>{s}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={[styles.send, (!prompt.trim() || sending) && styles.sendOff]}
        onPress={send}
        disabled={!prompt.trim() || sending}
        testID="ask-send"
      >
        {sending ? (
          <ActivityIndicator color={colors.onEmber} />
        ) : (
          <Text style={styles.sendText}>Ask {first}</Text>
        )}
      </TouchableOpacity>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  input: {
    fontFamily: type.moment.fontFamily,
    fontSize: 19,
    lineHeight: 26,
    color: colors.ink,
    minHeight: 96,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceSunk,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    padding: space.md,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  startersLabel: {
    ...type.eyebrow,
    color: colors.inkMuted,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  starter: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: space.xs + 2,
  },
  starterText: {
    ...type.bodySm,
    color: colors.inkSoft,
  },
  send: {
    marginTop: space.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: {
    opacity: 0.5,
  },
  sendText: {
    ...type.h3,
    color: colors.onEmber,
  },
});
