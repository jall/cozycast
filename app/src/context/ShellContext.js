import React, { createContext, useCallback, useContext, useState } from 'react';

// Which home tab (Fireside / Record / You) is showing. Lives above the router
// so the laptop rail — which stays put on every route, notifications and cast
// pages included — can switch tabs from anywhere. `friendsVersion` ticks when
// your address book changes (an invite redeemed) so lists of people refetch.
const ShellContext = createContext(null);

export function ShellProvider({ children }) {
  const [tab, setTab] = useState('feed');
  const [friendsVersion, setFriendsVersion] = useState(0);
  // "Record with Ben" from someone's page: who to pre-tag in the next cast.
  const [recordWith, setRecordWith] = useState(null);
  // Answering someone's ask: { id, prompt, from: { id, name } } — the next cast
  // goes to them and marks the ask answered.
  const [answering, setAnswering] = useState(null);
  const bumpFriends = useCallback(() => setFriendsVersion((v) => v + 1), []);
  return (
    <ShellContext.Provider
      value={{
        tab,
        setTab,
        friendsVersion,
        bumpFriends,
        recordWith,
        setRecordWith,
        answering,
        setAnswering,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within a ShellProvider');
  return ctx;
}
