import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// A small, cozy toast system: soft, non-blocking feedback that replaces the
// browser's native alert() on web (which is a no-op on native and jarring
// everywhere). Use it via useToast(): toast.success / .error / .info.

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

// On-brand tints, matching the inline feedback styles used elsewhere.
const VARIANTS = {
  success: { bg: '#EDF7EE', border: '#C3E2C6', fg: '#2F6B34', icon: 'checkmark-circle' },
  error: { bg: '#FCEDE9', border: '#F3C9BD', fg: '#B5482E', icon: 'alert-circle' },
  info: { bg: '#FFF3E9', border: '#F0D9C8', fg: '#9A6A3F', icon: 'leaf' },
};

let idSeq = 0;

function ToastItem({ toast, onDismiss }) {
  const anim = useRef(new Animated.Value(0)).current;

  const dismiss = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      onDismiss(toast.id),
    );
  }, [anim, onDismiss, toast.id]);

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const timer = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [anim, dismiss, toast.duration]);

  const v = VARIANTS[toast.type] || VARIANTS.info;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
          ],
        },
      ]}
    >
      <Ionicons name={v.icon} size={20} color={v.fg} style={styles.icon} />
      <Text style={[styles.text, { color: v.fg }]}>{toast.message}</Text>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color={v.fg} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const showToast = useCallback((message, opts = {}) => {
    const id = ++idSeq;
    setToasts((list) => [
      ...list,
      { id, message, type: opts.type || 'info', duration: opts.duration || 3400 },
    ]);
    return id;
  }, []);

  const value = useRef({
    showToast,
    success: (m, o) => showToast(m, { ...o, type: 'success' }),
    error: (m, o) => showToast(m, { ...o, type: 'error' }),
    info: (m, o) => showToast(m, { ...o, type: 'info' }),
  }).current;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={styles.host} pointerEvents="box-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={remove} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    marginRight: 8,
  },
});

export default ToastContext;
