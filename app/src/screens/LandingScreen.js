import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme/typography';

const STEPS = [
  {
    icon: 'mic-outline',
    title: 'Record or upload',
    text: 'Capture a real conversation, or bring one you already have.',
  },
  {
    icon: 'people-outline',
    title: 'Tag who was there',
    text: 'Note the voices in the room so everyone is accounted for.',
  },
  {
    icon: 'person-outline',
    title: 'One person shares',
    text: 'A single person is responsible for deciding where it goes.',
  },
  {
    icon: 'heart-outline',
    title: 'It lands gently',
    text: 'It appears only in the private feeds of the people they chose.',
  },
];

export default function LandingScreen({ onGetStarted, onOpenManifesto }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.wordmark}>cozycast</Text>
          <Text style={styles.tagline}>
            small, private conversations — shared only with the people you choose.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>WHAT IS A COZY CAST?</Text>
          <Text style={styles.bodyText}>
            A Cozy Cast is a private, intimate conversation you record (or upload) and pass
            person-to-person to specific people you trust.
          </Text>
          <Text style={styles.bodyText}>
            There is no public feed. No algorithm. No broadcasting to strangers. The person being
            interviewed decides who gets to listen — distribution is a choice, not a default.
          </Text>
        </View>

        <View style={styles.howSection}>
          <Text style={styles.sectionHeading}>How it works</Text>
          {STEPS.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon} size={22} color="#E8734A" />
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>
                  {index + 1}. {step.title}
                </Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.philosophyCard}>
          <Text style={styles.sectionHeading}>Why cozy?</Text>
          <Text style={styles.bodyText}>
            Most of the internet rewards performance. Cozy Cast is built for the opposite —
            curiosity, genuine listening, and conversation for its own sake. No clout to chase, no
            audience to play to.
          </Text>
          <TouchableOpacity
            style={styles.manifestoLink}
            onPress={onOpenManifesto}
            activeOpacity={0.6}
          >
            <Text style={styles.manifestoLinkText}>Read the manifesto</Text>
            <Ionicons name="arrow-forward" size={16} color="#E8734A" />
          </TouchableOpacity>
        </View>

        <View style={styles.ctaSection}>
          <TouchableOpacity style={styles.primaryButton} onPress={onGetStarted} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Get started</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signInLink} onPress={onGetStarted} activeOpacity={0.6}>
            <Text style={styles.signInText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
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
    paddingVertical: 56,
  },
  content: {
    width: '100%',
    maxWidth: 640,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  wordmark: {
    fontSize: 48,
    fontFamily: fonts.display,
    color: '#E8734A',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 17,
    fontFamily: fonts.regular,
    color: '#8C7B6B',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 420,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    marginBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#B0A090',
    letterSpacing: 1,
    marginBottom: 14,
  },
  bodyText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: '#4A4036',
    lineHeight: 25,
    marginBottom: 12,
  },
  howSection: {
    marginBottom: 36,
  },
  sectionHeading: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FCEDE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepBody: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#2D2D2D',
    marginBottom: 3,
  },
  stepText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#8C7B6B',
    lineHeight: 22,
  },
  philosophyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  manifestoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  manifestoLinkText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#E8734A',
    marginRight: 6,
  },
  ctaSection: {
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#E8734A',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    alignSelf: 'stretch',
    shadowColor: '#E8734A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: fonts.bold,
  },
  signInLink: {
    marginTop: 18,
    alignItems: 'center',
  },
  signInText: {
    color: '#E8734A',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
});
