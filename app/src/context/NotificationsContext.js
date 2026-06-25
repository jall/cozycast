import React, { createContext, useContext, useState, useCallback } from 'react';
import { getUnreadNotificationCount, markNotificationsRead } from '../api/client';

// Holds the unread-notification count so the feed's bell badge and the
// notifications screen stay in sync. Deliberately thin: the screen owns the
// list; this just tracks the badge and exposes refresh / mark-all-read.
const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setUnreadCount(await getUnreadNotificationCount());
    } catch {
      // Signed out / offline — leave the last known count.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setUnreadCount(0); // optimistic
    try {
      await markNotificationsRead();
    } catch {
      // Revert by refetching the true count.
      refresh();
    }
  }, [refresh]);

  const value = { unreadCount, refresh, markAllRead };
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
