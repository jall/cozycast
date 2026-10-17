import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { type } from '../theme/type';
import { space, radius, elevation } from '../theme/space';
import PressableScale from '../components/PressableScale';
import Campfire from '../components/Campfire';
import NightSky from '../components/NightSky';

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

export default function LandingScreen({ onGetStarted, onOpenManifesto, invited }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <NightSky height={340} radius={radius.lg} seed="landing" style={styles.sky}>
          <View style={styles.hero}>
            <Text style={styles.wordmark}>cozycast</Text>
            <Text style={styles.tagline}>
              small, private conversations — shared only with the people you choose.
            </Text>
          </View>
          <Campfire width={170} style={styles.fire} />
        </NightSky>

        {invited ? (
          <View style={styles.invite}>
            <Text style={styles.inviteTitle}>Someone saved you a seat by the fire.</Text>
            <Text style={styles.inviteBody}>
              Join and you’ll be connected with them. Nothing is shared until someone chooses to
              share it with you.
            </Text>
            <PressableScale style={styles.inviteButton} onPress={onGetStarted}>
              <Text style={styles.inviteButtonText}>Accept the invite</Text>
            </PressableScale>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>what is a cozy cast?</Text>
          <Text style={styles.bodyText}>
            A cozy cast is a private, intimate conversation you record (or upload) and pass
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
                <Ionicons name={step.icon} size={22} color={colors.ember} />
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
            Most of the internet rewards performance. cozycast is built for the opposite —
            curiosity, genuine listening, and conversation for its own sake. No clout to chase, no
            audience to play to.
          </Text>
          <TouchableOpacity
            style={styles.manifestoLink}
            onPress={onOpenManifesto}
            activeOpacity={0.6}
          >
            <Text style={styles.manifestoLinkText}>Read the manifesto</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.emberInk} />
          </TouchableOpacity>
        </View>

        <View style={styles.ctaSection}>
          <PressableScale style={styles.primaryButton} onPress={onGetStarted}>
            <Text style={styles.primaryButtonText}>Get started</Text>
          </PressableScale>
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
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  content: {
    width: '100%',
    maxWidth: 640,
  },
  invite: {
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: '#6B3A28',
    borderRadius: radius.md,
    padding: space.xl,
    marginTop: -16,
    marginBottom: 40,
    alignItems: 'center',
  },
  inviteTitle: {
    fontFamily: type.moment.fontFamily,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    textAlign: 'center',
  },
  inviteBody: {
    ...type.bodySm,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: space.sm,
    maxWidth: 420,
  },
  inviteButton: {
    marginTop: space.lg,
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  inviteButtonText: {
    ...type.h3,
    color: colors.onEmber,
  },
  sky: {
    marginBottom: 40,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: space.xl,
  },
  fire: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
  },
  wordmark: {
    ...type.moment,
    fontSize: 54,
    lineHeight: 60,
    color: colors.ink,
    letterSpacing: -1.5,
  },
  tagline: {
    ...type.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.inkSoft,
    marginTop: space.md,
    textAlign: 'center',
    maxWidth: 420,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 28,
    marginBottom: 36,
    ...elevation.rest,
  },
  sectionLabel: {
    ...type.eyebrow,
    color: colors.inkMuted,
    marginBottom: space.md + 2,
  },
  bodyText: {
    ...type.body,
    lineHeight: 25,
    color: colors.inkSoft,
    marginBottom: space.md,
  },
  howSection: {
    marginBottom: 36,
  },
  sectionHeading: {
    ...type.h2,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: space.lg + 4,
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
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepBody: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    ...type.h3,
    color: colors.ink,
    marginBottom: 3,
  },
  stepText: {
    ...type.bodySm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted,
  },
  philosophyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 28,
    marginBottom: 40,
    ...elevation.rest,
  },
  manifestoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.xs + 2,
  },
  manifestoLinkText: {
    ...type.h3,
    color: colors.emberInk,
    marginRight: space.xs + 2,
  },
  ctaSection: {
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    paddingHorizontal: space['3xl'],
    alignItems: 'center',
    alignSelf: 'stretch',
    ...elevation.raised,
  },
  primaryButtonText: {
    ...type.h3,
    fontSize: 17,
    color: colors.onEmber,
  },
  signInLink: {
    marginTop: space.lg + 2,
    alignItems: 'center',
  },
  signInText: {
    ...type.label,
    fontSize: 14,
    color: colors.emberInk,
  },
});
