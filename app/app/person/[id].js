import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Avatar from '../../src/components/Avatar';
import CastCard from '../../src/components/CastCard';
import NightSky from '../../src/components/NightSky';
import MiniPlayer from '../../src/components/MiniPlayer';
import { getFeed, getPerson } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { useShell } from '../../src/context/ShellContext';
import { castsBetween, friendTint } from '../../src/utils/people';
import { rememberCasts } from '../../src/utils/castCache';
import { colors } from '../../src/theme/colors';
import { type } from '../../src/theme/type';
import { space, radius, layout } from '../../src/theme/space';

function Section({ title, casts, onShared }) {
  if (casts.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {casts.map((c, i) => (
        <CastCard key={c.id} cast={c} index={i} onShared={onShared} />
      ))}
    </View>
  );
}

// Someone's page: who they are to you, and everything that's passed between
// you — what they've shared with you, what you've shared with them, and the
// casts you're both in — plus a way to start the next one together.
export default function PersonScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { setTab, setRecordWith } = useShell();
  const [person, setPerson] = useState(null);
  const [casts, setCasts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, feed] = await Promise.all([getPerson(id), getFeed().catch(() => [])]);
    rememberCasts(feed);
    setPerson(p);
    setCasts(feed);
  }, [id]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    load()
      .catch(() => live && setPerson(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [load]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  function recordWith() {
    setRecordWith({ id: person.id, name: person.name, avatar_path: person.avatar_path });
    setTab('record');
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.ember} />
      </View>
    );
  }

  if (!person) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.missing}>We couldn’t find that person.</Text>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.back}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const first = (person.name || 'them').split(/\s+/)[0];
  const { fromThem, fromYou, together } = castsBetween(casts, person.id, user?.id);
  const total = fromThem.length + fromYou.length + together.length;

  return (
    <View style={styles.container} testID="person">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backRow} onPress={goBack} activeOpacity={0.6}>
          <Ionicons name="arrow-back" size={20} color={colors.emberInk} />
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>

        <NightSky radius={radius.lg} seed={person.id} style={styles.sky}>
          <View style={styles.hero}>
            <View style={[styles.ring, { borderColor: friendTint(person.name) }]}>
              <Avatar name={person.name} path={person.avatar_path} size={92} />
            </View>
            <Text style={styles.name}>{person.name}</Text>
            <Text style={styles.relation}>
              {person.is_me
                ? 'This is you.'
                : person.is_friend
                  ? total > 0
                    ? `Around your fire · ${total} ${total === 1 ? 'cast' : 'casts'} between you`
                    : 'Around your fire — nothing shared between you yet'
                  : 'Not in your address book'}
            </Text>
            {!person.is_me ? (
              <TouchableOpacity style={styles.cta} onPress={recordWith} activeOpacity={0.85}>
                <Ionicons name="mic" size={18} color={colors.onEmber} />
                <Text style={styles.ctaText}>Record with {first}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </NightSky>

        <Section title={`From ${first}`} casts={fromThem} onShared={load} />
        <Section title={`From you to ${first}`} casts={fromYou} onShared={load} />
        <Section title={`${first}’s in these`} casts={together} onShared={load} />

        {total === 0 && !person.is_me ? (
          <Text style={styles.empty}>
            Nothing’s passed between you yet. Record something together, or share a cast with{' '}
            {first} from its page.
          </Text>
        ) : null}
      </ScrollView>
      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll: {
    width: '100%',
    maxWidth: layout.feed,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space['2xl'],
    paddingBottom: space['3xl'],
  },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.lg },
  back: { ...type.label, color: colors.emberInk, marginLeft: space.xs },
  sky: { borderWidth: 1, borderColor: colors.hairline, marginBottom: space.xl },
  hero: { alignItems: 'center', paddingTop: space['2xl'], paddingBottom: 72 },
  ring: { borderWidth: 3, borderRadius: 52, padding: 3 },
  name: { ...type.moment, fontSize: 40, lineHeight: 46, color: colors.ink, marginTop: space.md },
  relation: { ...type.bodySm, color: colors.inkSoft, marginTop: space.xs, textAlign: 'center' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
    backgroundColor: colors.ember,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  ctaText: { ...type.h3, color: colors.onEmber, marginLeft: space.sm },
  section: { marginBottom: space.lg },
  sectionTitle: {
    fontFamily: type.moment.fontFamily,
    fontSize: 21,
    lineHeight: 26,
    color: colors.ink,
    marginBottom: space.md,
  },
  empty: {
    ...type.bodySm,
    color: colors.inkMuted,
    textAlign: 'center',
    paddingHorizontal: space.xl,
  },
  missing: { ...type.h2, color: colors.ink, marginBottom: space.md },
});
