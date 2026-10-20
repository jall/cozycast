import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { searchEverything, getFriends } from '../src/api/client';
import { snippetRuns, resultHref } from '../src/utils/search';
import { formatClock } from '../src/utils/waveform';
import { timeAgo } from '../src/utils/time';
import { colors } from '../src/theme/colors';
import { type } from '../src/theme/type';
import { space, radius, layout } from '../src/theme/space';

const KIND = {
  cast: { icon: 'radio-outline', label: () => 'Title & summary' },
  said: { icon: 'mic-outline', label: (r) => `Said at ${formatClock(r.at_ms)}` },
  comment: {
    icon: 'chatbubble-outline',
    label: (r) => (r.at_ms != null ? `A note at ${formatClock(r.at_ms)}` : 'A note along the way'),
  },
  note: { icon: 'chatbubbles-outline', label: (r, name) => `Voice note with ${name}` },
};

// Search everything you can hear — titles, what was said (to the moment), notes
// along the way, and voice notes. Matches as you type; tap to play from there.
export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState([]);
  const seq = useRef(0);

  useEffect(() => {
    getFriends()
      .then(setFriends)
      .catch(() => {});
  }, []);

  // Debounced, and only the latest answer counts.
  useEffect(() => {
    const q = query.trim();
    const mine = (seq.current += 1);
    if (!q) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchEverything(q)
        .then((r) => mine === seq.current && setResults(r))
        .catch(() => mine === seq.current && setResults([]))
        .finally(() => mine === seq.current && setSearching(false));
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const nameOf = (id) => friends.find((f) => f.id === id)?.name || 'someone';

  return (
    <View style={styles.container} testID="search">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <Ionicons name="arrow-back" size={20} color={colors.emberInk} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.field}>
          <Ionicons name="search" size={18} color={colors.inkMuted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search what was said…"
            placeholderTextColor={colors.inkFaint}
            autoFocus
            returnKeyType="search"
            accessibilityLabel="Search"
            testID="search-input"
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.inkMuted} />
          ) : query ? (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear">
              <Ionicons name="close-circle" size={18} color={colors.inkMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {!query.trim() ? (
          <View style={styles.hint}>
            <Text style={styles.hintTitle}>Find the bit where…</Text>
            <Text style={styles.hintBody}>
              Search a word someone said, a place, a name, a title. It looks through every cast you
              can hear (down to the moment it was said), notes along the way, and your voice notes —
              and nothing else.
            </Text>
          </View>
        ) : !searching && results.length === 0 ? (
          <Text style={styles.none}>Nothing found for “{query.trim()}”.</Text>
        ) : (
          results.map((r, i) => {
            const kind = KIND[r.kind] || KIND.cast;
            return (
              <TouchableOpacity
                key={`${r.kind}-${r.cast_id || r.note_id}-${r.at_ms ?? 'x'}-${i}`}
                style={styles.result}
                onPress={() => router.push(resultHref(r))}
                activeOpacity={0.8}
                testID="search-result"
              >
                <View style={styles.resultIcon}>
                  <Ionicons name={kind.icon} size={16} color={colors.emberSoft} />
                </View>
                <View style={styles.resultMain}>
                  <View style={styles.resultTop}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {r.kind === 'note' && !r.title ? 'Just chat' : r.title || 'A cast'}
                    </Text>
                    <Text style={styles.resultWhen}>{timeAgo(r.created_at)}</Text>
                  </View>
                  <Text style={styles.snippet} numberOfLines={3}>
                    {snippetRuns(r.snippet).map((run, j) => (
                      <Text key={j} style={run.hit ? styles.hit : null}>
                        {run.text}
                      </Text>
                    ))}
                  </Text>
                  <Text style={styles.kind}>{kind.label(r, nameOf(r.other_id))}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.lg,
    paddingTop: space.xl,
    width: '100%',
    maxWidth: layout.column,
    alignSelf: 'center',
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.lg },
  backText: { ...type.label, color: colors.emberInk },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: space.xl,
  },
  input: {
    ...type.body,
    flex: 1,
    color: colors.ink,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  hint: { gap: space.sm, paddingHorizontal: space.sm },
  hintTitle: {
    fontFamily: type.moment.fontFamily,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
  },
  hintBody: { ...type.bodySm, color: colors.inkMuted },
  none: { ...type.bodySm, color: colors.inkMuted, paddingHorizontal: space.sm },
  result: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    marginHorizontal: -space.sm,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  resultMain: { flex: 1, minWidth: 0, gap: 2 },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  resultTitle: { ...type.h3, color: colors.ink, flexShrink: 1 },
  resultWhen: { ...type.time, fontSize: 11, color: colors.inkMuted },
  snippet: { ...type.bodySm, color: colors.inkSoft },
  hit: { color: colors.ink, fontFamily: type.h3.fontFamily, backgroundColor: colors.accentSurface },
  kind: { ...type.caption, color: colors.inkMuted },
});
