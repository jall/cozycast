import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useLayout from '../hooks/useLayout';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, radius, elevation } from '../theme/space';

// A calm modal: a centred card on a laptop, a bottom sheet on a phone. Rises in
// gently; tap the dim backdrop, the close button, or press Escape to dismiss.
export default function Sheet({ visible, onClose, title, subtitle, children, testID }) {
  const { wide } = useLayout();
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    rise.setValue(0);
    Animated.timing(rise, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, rise]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, wide ? styles.centered : styles.bottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          testID={testID}
          style={[
            styles.card,
            wide ? styles.cardWide : styles.cardPhone,
            {
              opacity: rise,
              transform: [
                { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.head}>
            <View style={styles.headText}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 6, 12, 0.72)',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  bottom: {
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    maxHeight: '86%',
    ...elevation.raised,
  },
  cardWide: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radius.lg,
  },
  cardPhone: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: space.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.md,
  },
  headText: {
    flex: 1,
  },
  title: {
    ...type.h2,
    color: colors.ink,
  },
  subtitle: {
    ...type.bodySm,
    color: colors.inkMuted,
    marginTop: space.xs,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.md,
    marginTop: -4,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
  },
});
