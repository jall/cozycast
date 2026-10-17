import React, { useEffect, useState } from 'react';
import { getPendingInvite } from '../utils/invites';
import LandingScreen from './LandingScreen';
import ManifestoScreen from './ManifestoScreen';
import LoginScreen from './LoginScreen';

// The public, unauthenticated surface: landing → sign in, plus the manifesto.
// These aren't router routes — they're a small local-state flow shown whenever
// there's no session (see app/_layout.js).
export default function PublicRoot() {
  const [view, setView] = useState('landing'); // 'landing' | 'login' | 'manifesto'
  // Opened from someone's invite link (see utils/invites)?
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    getPendingInvite().then((code) => code && setInvite(code));
  }, []);

  if (view === 'login') return <LoginScreen onBack={() => setView('landing')} invite={invite} />;
  if (view === 'manifesto') return <ManifestoScreen onBack={() => setView('landing')} />;
  return (
    <LandingScreen
      invited={!!invite}
      onGetStarted={() => setView('login')}
      onOpenManifesto={() => setView('manifesto')}
    />
  );
}
