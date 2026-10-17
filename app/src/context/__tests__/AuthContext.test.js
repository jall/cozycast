import { renderHook, waitFor, act } from '@testing-library/react-native';
import { supabase } from '../../api/supabase';
import { savePendingInvite } from '../../utils/invites';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock the Supabase client and invite storage so signup logic can be tested
// without any network access.
jest.mock('../../api/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));
jest.mock('../../utils/invites', () => ({ savePendingInvite: jest.fn() }));

async function setupAuth() {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  // The provider's mount effect resolves getSession and flips loading off.
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

describe('AuthContext signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  it('reports needsConfirmation when signUp returns no session', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });
    const result = await setupAuth();

    const res = await result.current.signup('a@b.com', 'pw', 'Ada');

    expect(res).toEqual({ needsConfirmation: true });
  });

  it('flags an already-registered email (empty identities) and keeps no invite', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [] }, session: null },
      error: null,
    });
    const result = await setupAuth();

    const res = await result.current.signup('taken@b.com', 'pw', 'Ada', 'CODE12');

    expect(res).toEqual({ alreadyRegistered: true });
    expect(savePendingInvite).not.toHaveBeenCalled();
  });

  it('reports no confirmation needed when a session is returned', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 't' } },
      error: null,
    });
    const result = await setupAuth();

    const res = await result.current.signup('a@b.com', 'pw', 'Ada');

    expect(res).toEqual({ needsConfirmation: false });
  });

  it('passes the configured site URL as the email redirect', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });
    const result = await setupAuth();

    await result.current.signup('a@b.com', 'pw', 'Ada');

    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: { name: 'Ada' },
          emailRedirectTo: expect.stringContaining('http'),
        }),
      }),
    );
  });

  it('keeps an invite code to redeem once signed in', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });
    const result = await setupAuth();

    await expect(result.current.signup('a@b.com', 'pw', 'Ada', 'CODE12')).resolves.toEqual({
      needsConfirmation: true,
    });
    expect(savePendingInvite).toHaveBeenCalledWith('CODE12');
  });

  it('throws when signUp returns an error', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: {}, error: new Error('boom') });
    const result = await setupAuth();

    await expect(result.current.signup('a@b.com', 'pw', 'Ada')).rejects.toThrow('boom');
  });
});

describe('AuthContext password reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  it('requestPasswordReset emails a reset link pointed at the site URL', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const result = await setupAuth();

    await result.current.requestPasswordReset('a@b.com');

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', {
      redirectTo: expect.any(String),
    });
  });

  it('enters recovery mode on the PASSWORD_RECOVERY event', async () => {
    let authCallback;
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    const result = await setupAuth();

    expect(result.current.passwordRecovery).toBe(false);
    await act(async () => {
      authCallback('PASSWORD_RECOVERY', null);
    });
    expect(result.current.passwordRecovery).toBe(true);
  });

  it('updatePassword updates the user', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: null });
    const result = await setupAuth();

    await result.current.updatePassword('newpass123');

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' });
  });
});
