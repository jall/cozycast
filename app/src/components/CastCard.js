import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CastCover from './CastCover';
import Faces from './Faces';
import Waveform from './Waveform';
import PressableScale from './PressableScale';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { timeAgo } from '../utils/time';
import { formatClock } from '../utils/waveform';
import { castBy, trackFor } from '../utils/track';
import { castProgress } from '../utils/progress';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius, elevation } from '../theme/space';

// A cast in the feed. Even before anyone presses play it shows its *shape*: a
// little night-sky cover, who it's by and who's around it, its waveform with
// what you've heard banked in ember, and how long it is (or how long is left).
// The playing card glows. Tap anywhere for the detail page; the play button
// claims its own presses.
export default function CastCard({ cast, index = 0 }) {
  const { id, title, summary, description, participants, recipient_count, shared_with_me, played } =
    cast;

  const router = useRouter();
  const { user } = useAuth();
  const player = usePlayer();
  const { width } = useWindowDimensions();
  const compact = width < 600;

  const openDetail = () => router.push(`/cast/${id}`);

  // A cast left for you (you're a recipient, not the creator/sharer) that you
  // haven't listened to yet.
  const unheard = shared_with_me && !cast.can_manage && !played;

  // You're the assigned sharer (not the creator) and haven't sent it yet.
  const needsSharing =
    !!user && cast.sharer_id === user.id && cast.creator_id !== user.id && recipient_count === 0;
  // Yours, and still only yours.
  const onlyYou = !shared_with_me && !needsSharing && cast.can_manage && recipient_count === 0;

  const { isCurrent, total, at, done } = castProgress(cast, player);
  const playing = isCurrent && player.isPlaying;
  const started = at > 0 && !done && at < total;
  const timeLabel = !total
    ? ''
    : isCurrent
      ? `${formatClock(at)} / ${formatClock(total)}`
      : done
        ? `Heard · ${formatClock(total)}`
        : started
          ? `${formatClock(total - at)} left`
          : formatClock(total);

  // Gentle staggered fade-in-up as cards arrive.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 360,
      delay: Math.min(index, 8) * 55,
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  const body = summary || description;
  const by = castBy(cast);
  const others = (Array.isArray(participants) ? participants : []).filter((n) => n !== by);
  const withLine = others.length > 0 ? `with ${others.join(', ')}` : '';

  const playButton = cast.audio_path ? (
    <TouchableOpacity
      onPress={() => player.toggle(trackFor(cast))}
      style={[styles.play, compact && styles.playCompact, isCurrent && styles.playLive]}
      activeOpacity={0.8}
      accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${title}`}
    >
      <Ionicons
        name={playing ? 'pause' : 'play'}
        size={compact ? 18 : 22}
        color={isCurrent ? colors.onEmber : colors.ink}
        style={playing ? null : styles.playNudge}
      />
    </TouchableOpacity>
  ) : null;

  const meta = (
    <View style={styles.metaRow}>
      {unheard ? (
        <View style={styles.newChip} accessibilityLabel="Unheard">
          <Text style={styles.newText}>New</Text>
        </View>
      ) : null}
      <Text style={styles.by} numberOfLines={1}>
        {cast.creator_id === user?.id ? 'You' : by}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {withLine ? `${withLine} · ` : '· '}
        {timeAgo(cast.created_at)}
      </Text>
    </View>
  );

  const shapeRow = (
    <View style={styles.shapeRow}>
      <Waveform
        seed={id}
        bars={compact ? 36 : 56}
        height={compact ? 24 : 30}
        progress={total ? at / total : 0}
        playedColor={isCurrent ? colors.ember : colors.emberDeep}
        style={styles.wave}
      />
      {timeLabel ? (
        <Text style={[styles.time, (started || isCurrent) && styles.timeLive]}>{timeLabel}</Text>
      ) : null}
      {cast.comment_count > 0 ? (
        <View style={styles.count} accessibilityLabel={`${cast.comment_count} notes`}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.inkMuted} />
          <Text style={styles.countText}>{cast.comment_count}</Text>
        </View>
      ) : null}
      {!compact ? <Faces names={[by, ...others]} size={24} /> : null}
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      <PressableScale
        style={[styles.card, compact && styles.cardCompact, isCurrent && styles.cardLive]}
        hoverStyle={styles.cardHover}
        onPress={openDetail}
        accessibilityLabel={`Open ${title}`}
      >
        {compact ? (
          <>
            <View style={styles.head}>
              <CastCover seed={id} title={title} size={60} />
              <View style={styles.headText}>
                {meta}
                <Text style={[styles.title, styles.titleCompact]} numberOfLines={2}>
                  {title}
                </Text>
              </View>
              {playButton}
            </View>
            {body ? (
              <Text style={styles.summary} numberOfLines={2}>
                {body}
              </Text>
            ) : null}
            {shapeRow}
          </>
        ) : (
          <View style={styles.wide}>
            <CastCover seed={id} title={title} size={100} radius={18} />
            <View style={styles.wideMain}>
              {meta}
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              {body ? (
                <Text style={styles.summary} numberOfLines={2}>
                  {body}
                </Text>
              ) : null}
              {shapeRow}
            </View>
            {playButton}
          </View>
        )}

        {needsSharing || onlyYou ? (
          <TouchableOpacity style={styles.nudge} onPress={openDetail} activeOpacity={0.75}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.emberInk} />
            <Text style={styles.nudgeText}>
              {needsSharing
                ? 'You’re the sharer — choose who gathers round.'
                : 'Only you can hear this so far.'}
            </Text>
            <View style={styles.nudgeButton}>
              <Text style={styles.nudgeButtonText}>Choose people</Text>
            </View>
          </TouchableOpacity>
        ) : !shared_with_me && recipient_count > 0 ? (
          <Text style={styles.sharedNote}>
            Shared with {recipient_count} {recipient_count === 1 ? 'person' : 'people'} — only the
            ones you chose
          </Text>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    marginBottom: space.md + 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.lg,
    paddingRight: space.xl,
  },
  cardCompact: {
    padding: space.md + 2,
  },
  cardLive: {
    borderColor: '#6B3A28',
    ...elevation.glow,
    shadowOpacity: 0.18,
  },
  cardHover: {
    backgroundColor: colors.surfaceRaised,
  },
  wide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wideMain: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: space.xl - 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headText: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: space.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.xs + 2,
  },
  newChip: {
    backgroundColor: '#3A1F17',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginRight: space.sm,
  },
  newText: {
    ...type.monoLabel,
    fontSize: 10,
    color: colors.emberInk,
  },
  by: {
    ...type.label,
    fontFamily: type.h3.fontFamily,
    color: colors.inkSoft,
    marginRight: space.xs + 2,
  },
  meta: {
    ...type.caption,
    fontSize: 13,
    color: colors.inkMuted,
    flexShrink: 1,
  },
  title: {
    ...type.h2,
    fontSize: 23,
    lineHeight: 28,
    color: colors.ink,
  },
  titleCompact: {
    fontSize: 18,
    lineHeight: 22,
  },
  summary: {
    ...type.bodySm,
    color: '#B3A595',
    marginTop: space.xs + 2,
  },
  shapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
  },
  wave: {
    flex: 1,
    minWidth: 0,
    marginRight: space.md,
  },
  time: {
    ...type.time,
    fontSize: 12,
    color: colors.inkMuted,
    marginRight: space.md,
  },
  timeLive: {
    color: colors.emberInk,
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: space.md,
  },
  countText: {
    ...type.caption,
    fontSize: 13,
    color: colors.inkMuted,
    marginLeft: 4,
  },
  play: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2E2636',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  playLive: {
    backgroundColor: colors.ember,
    ...elevation.glow,
  },
  playNudge: {
    marginLeft: 3,
  },
  sharedNote: {
    ...type.caption,
    color: colors.inkMuted,
    marginTop: space.md,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
    backgroundColor: colors.accentSurface,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#6B3A28',
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
  },
  nudgeText: {
    ...type.bodySm,
    color: colors.ink,
    flex: 1,
    marginHorizontal: space.sm + 2,
  },
  nudgeButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.xs + 3,
  },
  nudgeButtonText: {
    ...type.label,
    fontFamily: type.h3.fontFamily,
    color: colors.onEmber,
  },
});
