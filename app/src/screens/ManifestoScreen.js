import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme/typography';

const SOFT_TIPS = [
  'Ask one more question than feels natural.',
  'Leave a comfortable silence — let it breathe.',
  'Share something true, even if it is small.',
  'Follow the thread you are most curious about, not the one that sounds clever.',
];

export default function ManifestoScreen({ onBack }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.6}>
          <Ionicons name="arrow-back" size={20} color="#E8734A" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.wordmark}>cozycast</Text>
        <Text style={styles.title}>The manifesto</Text>
        <Text style={styles.subtitle}>A small set of beliefs about talking, and listening.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>No feed, no stage</Text>
          <Text style={styles.bodyText}>
            There is nothing to scroll here, and no one is watching. A Cozy Cast is not a broadcast
            — it is a conversation that happens to be kept. When no one is performing, something
            more honest gets to show up.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Conversation for its own sake</Text>
          <Text style={styles.bodyText}>
            We are not collecting clout, optimizing reach, or harvesting hot takes. The point is the
            talking itself: the warmth of being asked a real question, and the quiet pleasure of
            answering it without an audience.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Curiosity over cleverness</Text>
          <Text style={styles.bodyText}>
            The best conversations are not won. Come to learn what the other person actually thinks,
            not to land a point. Genuine listening is rarer, and far more generous, than a good
            comeback.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Consent travels with the voice</Text>
          <Text style={styles.bodyText}>
            The person being interviewed decides who hears them. Always. A recording is something
            someone trusted you with — distribution is their call, never an automatic one. One
            person carries the responsibility of sharing, and they share narrowly, on purpose.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>A small game</Text>
          <Text style={styles.bodyText}>
            These are not rules. Think of them as gentle moves — little nudges toward the kind of
            conversation worth keeping. Try one and see what opens up.
          </Text>
          <View style={styles.tipsCard}>
            {SOFT_TIPS.map((tip) => (
              <View key={tip} style={styles.tipRow}>
                <Ionicons name="ellipse" size={7} color="#E8734A" style={styles.tipDot} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>If you want to go public</Text>
          <Text style={styles.bodyText}>
            That is completely fine — just post it somewhere else yourself. Cozy Cast stays private
            by design. This is the room with the door closed, on purpose, so the people inside can
            speak freely.
          </Text>
        </View>

        <View style={styles.closing}>
          <Text style={styles.closingText}>Stay cozy.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  content: {
    width: '100%',
    maxWidth: 640,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  backText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#E8734A',
    marginLeft: 6,
  },
  wordmark: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: '#E8734A',
    letterSpacing: -1,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontFamily: fonts.display,
    color: '#2D2D2D',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: fonts.regular,
    color: '#8C7B6B',
    marginTop: 8,
    marginBottom: 36,
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeading: {
    fontSize: 21,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: '#4A4036',
    lineHeight: 26,
    marginBottom: 12,
  },
  tipsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  tipDot: {
    marginTop: 8,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: '#4A4036',
    lineHeight: 24,
  },
  closing: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  closingText: {
    fontSize: 18,
    fontFamily: fonts.display,
    color: '#E8734A',
    letterSpacing: -0.3,
  },
});
