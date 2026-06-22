import { renderHook, waitFor } from '@testing-library/react-native';
import { supabase } from '../../api/supabase';
import { redeemInvite } from '../../api/client';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock the Supabase client and the invite RPC so signup logic can be tested
// without any network access.
jest.mock('../../api/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
  },
}));
jest.mock('../../api/client', () => ({ redeemInvite: jest.fn() }));

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

    expect(res).toEqual({ needsConfirmation: true, inviteError: null });
  });

  it('reports no confirmation needed when a session is returned', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 't' } },
      error: null,
    });
    const result = await setupAuth();

    const res = await result.current.signup('a@b.com', 'pw', 'Ada');

    expect(res).toEqual({ needsConfirmation: false, inviteError: null });
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

  it('redeems an invite code after a successful signup', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });
    redeemInvite.mockResolvedValue(undefined);
    const result = await setupAuth();

    await result.current.signup('a@b.com', 'pw', 'Ada', 'CODE12');

    expect(redeemInvite).toHaveBeenCalledWith('CODE12');
  });

  it('still succeeds but reports the invite error if redemption fails', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });
    redeemInvite.mockRejectedValue(new Error('bad code'));
    // signup logs a warning when redemption fails; keep test output clean.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await setupAuth();

    await expect(result.current.signup('a@b.com', 'pw', 'Ada', 'NOPE')).resolves.toEqual({
      needsConfirmation: true,
      inviteError: 'bad code',
    });
  });

  it('throws when signUp returns an error', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: {}, error: new Error('boom') });
    const result = await setupAuth();

    await expect(result.current.signup('a@b.com', 'pw', 'Ada')).rejects.toThrow('boom');
  });
});
