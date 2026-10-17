import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { type } from '../theme/type';
import { space, elevation } from '../theme/space';

// The phone's slim tab bar: Fireside · a raised ember Record button · You.
export default function TabBar({ active, onNavigate }) {
  const insets = useSafeAreaInsets();
  const side = (key, icon, label) => {
    const on = active === key;
    return (
      <TouchableOpacity
        style={styles.tab}
        onPress={() => onNavigate(key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
      >
        <Ionicons
          name={on ? icon : `${icon}-outline`}
          size={23}
          color={on ? colors.emberInk : colors.inkMuted}
        />
        <Text style={[styles.label, on && styles.labelOn]}>{label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {side('feed', 'flame', 'Fireside')}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => onNavigate('record')}
        testID="nav-record"
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'record' }}
      >
        <View style={[styles.record, active === 'record' && styles.recordOn]}>
          <Ionicons name="mic" size={25} color={colors.onEmber} />
        </View>
        <Text style={[styles.label, active === 'record' && styles.labelOn]}>Record</Text>
      </TouchableOpacity>
      {side('profile', 'person', 'You')}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    backgroundColor: '#15121C',
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: space.sm,
  },
  tab: {
    width: 88,
    alignItems: 'center',
  },
  label: {
    ...type.caption,
    fontSize: 11,
    fontFamily: type.h3.fontFamily,
    color: colors.inkMuted,
    marginTop: 3,
  },
  labelOn: {
    color: colors.emberInk,
  },
  record: {
    width: 56,
    height: 56,
    marginTop: -26,
    borderRadius: 28,
    backgroundColor: colors.ember,
    borderWidth: 5,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.glow,
  },
  recordOn: {
    backgroundColor: colors.emberSoft,
  },
});
