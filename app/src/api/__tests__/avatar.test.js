import { supabase } from '../supabase';
import { avatarUrl, uploadAvatar } from '../client';

// Exercise the avatar helpers without touching the network/storage.
jest.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn(), getSession: jest.fn() },
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

describe('avatarUrl', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when there is no path', () => {
    expect(avatarUrl(null)).toBeNull();
    expect(avatarUrl(undefined)).toBeNull();
  });

  it('derives a public url from the avatars bucket', () => {
    const bucket = {
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn/u1/a.png' } })),
    };
    supabase.storage.from.mockReturnValue(bucket);

    expect(avatarUrl('u1/a.png')).toBe('https://cdn/u1/a.png');
    expect(supabase.storage.from).toHaveBeenCalledWith('avatars');
    expect(bucket.getPublicUrl).toHaveBeenCalledWith('u1/a.png');
  });
});

describe('uploadAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    global.fetch = jest.fn().mockResolvedValue({ blob: async () => ({ type: 'image/png' }) });
  });

  it('uploads under the user folder, repoints the profile, and removes the old file', async () => {
    const bucket = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      remove: jest.fn().mockResolvedValue({ error: null }),
    };
    supabase.storage.from.mockReturnValue(bucket);

    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { avatar_path: 'u1/old.png' } }),
    };
    const updateChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    supabase.from.mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain);

    const path = await uploadAvatar('blob:local', 'image/png');

    // Unique filename inside the user's own folder (storage RLS keys off this).
    expect(path).toMatch(/^u1\/\d+\.png$/);
    expect(supabase.storage.from).toHaveBeenCalledWith('avatars');
    expect(bucket.upload).toHaveBeenCalledWith(path, expect.anything(), {
      contentType: 'image/png',
    });
    expect(updateChain.update).toHaveBeenCalledWith({ avatar_path: path });
    // Best-effort cleanup of the previous avatar.
    expect(bucket.remove).toHaveBeenCalledWith(['u1/old.png']);
  });

  it('throws when the upload fails', async () => {
    const bucket = {
      upload: jest.fn().mockResolvedValue({ error: new Error('upload failed') }),
      remove: jest.fn(),
    };
    supabase.storage.from.mockReturnValue(bucket);

    await expect(uploadAvatar('blob:local', 'image/png')).rejects.toThrow('upload failed');
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});
