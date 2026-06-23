import React, { useState } from 'react';
import LandingScreen from './LandingScreen';
import ManifestoScreen from './ManifestoScreen';
import LoginScreen from './LoginScreen';

// The public, unauthenticated surface: landing → sign in, plus the manifesto.
// These aren't router routes — they're a small local-state flow shown whenever
// there's no session (see app/_layout.js).
export default function PublicRoot() {
  const [view, setView] = useState('landing'); // 'landing' | 'login' | 'manifesto'

  if (view === 'login') return <LoginScreen onBack={() => setView('landing')} />;
  if (view === 'manifesto') return <ManifestoScreen onBack={() => setView('landing')} />;
  return (
    <LandingScreen
      onGetStarted={() => setView('login')}
      onOpenManifesto={() => setView('manifesto')}
    />
  );
}
