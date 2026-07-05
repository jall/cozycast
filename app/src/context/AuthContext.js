import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabase';
import { redeemInvite } from '../api/client';

const AuthContext = createContext(null);

// Where Supabase should send users after they click the email confirmation
// link. Must also be allow-listed in the Supabase dashboard (Authentication →
// URL Configuration). Overridable per-environment via EXPO_PUBLIC_SITE_URL.
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || 'https://cozycast.jall.me';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // True after the user follows a password-reset link, until they set a new one.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Following a reset link establishes a temporary session and fires this —
      // route the user to "set a new password" rather than into the app.
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      const u = session?.user || null;
      setUser(u);
      if (u) loadProfile(u.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
  }

  // Re-fetch the signed-in user's profile (e.g. after they change their avatar)
  // so consumers of `user` see the update without a full reload.
  async function refreshProfile() {
    if (user?.id) await loadProfile(user.id);
  }

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signup(email, password, name, inviteCode) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: SITE_URL,
      },
    });
    if (error) throw error;

    // Supabase hides whether an email is already registered (anti-enumeration):
    // signUp "succeeds" but the returned user has an empty identities array and
    // no email is sent. Detect that so we can tell the user to log in instead of
    // claiming we sent a confirmation that never went out.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { alreadyRegistered: true };
    }

    // If invite code provided, redeem it after signup. Don't fail signup if it
    // doesn't take — but do report it back so the caller can tell the user
    // (otherwise they'd silently land in an empty app, unconnected).
    let inviteError = null;
    if (inviteCode && data.user) {
      try {
        await redeemInvite(inviteCode);
      } catch (e) {
        inviteError = e.message || 'That invite code could not be applied.';
        console.warn('Invite redemption failed:', e.message);
      }
    }

    // When email confirmation is enabled, signUp succeeds but no session is
    // created until the user clicks the link. Let the caller tell them so.
    return { needsConfirmation: !data.session, inviteError };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  // Send a password-reset email. The link returns the user to SITE_URL, where
  // detectSessionInUrl (web) consumes the token and fires PASSWORD_RECOVERY.
  async function requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
    if (error) throw error;
  }

  // Set the new password during a recovery session, then leave recovery mode.
  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setPasswordRecovery(false);
  }

  return (
    <AuthContext.Provider
      value={{
        user:
          profile ||
          (user ? { id: user.id, email: user.email, name: user.user_metadata?.name } : null),
        loading,
        passwordRecovery,
        login,
        signup,
        logout,
        requestPasswordReset,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
