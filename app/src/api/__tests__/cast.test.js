import { supabase } from '../supabase';
import { createCast, shareCast, getAudioUrl, deleteCast } from '../client';

// Mock the supabase client so we exercise the create / share / stream logic in
// client.js without any network or storage.
jest.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  // createCast fetches the recording URI and turns it into a blob.
  global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve('AUDIO_BLOB') });
});

describe('createCast (recording a cast)', () => {
  it('uploads audio to the user folder, inserts the cast, and tags participants', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const single = jest.fn().mockResolvedValue({ data: { id: 'c1' }, error: null });
    const castInsert = jest.fn(() => ({ select: () => ({ single }) }));
    const participantInsert = jest.fn().mockResolvedValue({ error: null });

    supabase.storage.from.mockReturnValue({ upload });
    supabase.from.mockImplementation((table) =>
      table === 'casts' ? { insert: castInsert } : { insert: participantInsert },
    );

    const result = await createCast({
      title: 'Kitchen talk',
      summary: 'A ramble about bread',
      audioUri: 'blob:local-recording',
      duration: 91,
      participants: [{ id: 'p1', name: 'Ben' }],
    });

    // Audio uploaded into the creator's own folder as an .m4a.
    expect(supabase.storage.from).toHaveBeenCalledWith('casts');
    const [path, blob, opts] = upload.mock.calls[0];
    expect(path).toMatch(/^u1\/\d+\.m4a$/);
    expect(blob).toBe('AUDIO_BLOB');
    expect(opts).toEqual({ contentType: 'audio/m4a' });

    // Cast row created with the creator defaulting to the sharer.
    expect(castInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: 'u1',
        sharer_id: 'u1',
        title: 'Kitchen talk',
        summary: 'A ramble about bread',
        duration: 91,
      }),
    );

    // Participant tagged against the new cast.
    expect(participantInsert).toHaveBeenCalledWith([
      { cast_id: 'c1', profile_id: 'p1', name: 'Ben' },
    ]);

    expect(result).toEqual({ id: 'c1' });
  });

  it('honours an explicitly assigned sharer and skips participant insert when none', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const single = jest.fn().mockResolvedValue({ data: { id: 'c2' }, error: null });
    const castInsert = jest.fn(() => ({ select: () => ({ single }) }));
    const participantInsert = jest.fn();

    supabase.storage.from.mockReturnValue({ upload });
    supabase.from.mockImplementation((table) =>
      table === 'casts' ? { insert: castInsert } : { insert: participantInsert },
    );

    await createCast({ title: 'Solo', audioUri: 'blob:x', sharerId: 'friend-9' });

    expect(castInsert).toHaveBeenCalledWith(expect.objectContaining({ sharer_id: 'friend-9' }));
    expect(participantInsert).not.toHaveBeenCalled();
  });

  it('uses the file’s real mime type and extension for uploaded audio', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const single = jest.fn().mockResolvedValue({ data: { id: 'c3' }, error: null });
    const castInsert = jest.fn(() => ({ select: () => ({ single }) }));

    supabase.storage.from.mockReturnValue({ upload });
    supabase.from.mockImplementation(() => ({ insert: castInsert }));

    await createCast({ title: 'Pod', audioUri: 'blob:x', mimeType: 'audio/mpeg' });

    const [path, , opts] = upload.mock.calls[0];
    expect(path).toMatch(/^u1\/\d+\.mp3$/);
    expect(opts).toEqual({ contentType: 'audio/mpeg' });
  });

  it('throws if the audio upload fails', async () => {
    supabase.storage.from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: new Error('storage down') }),
    });

    await expect(createCast({ title: 'T', audioUri: 'blob:x' })).rejects.toThrow('storage down');
  });
});

describe('shareCast', () => {
  it('upserts a recipient row per person, attributed to the current user', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ upsert });

    await shareCast('c1', ['r1', 'r2']);

    expect(supabase.from).toHaveBeenCalledWith('cast_recipients');
    const [rows, opts] = upsert.mock.calls[0];
    expect(rows).toEqual([
      { cast_id: 'c1', recipient_id: 'r1', shared_by: 'u1' },
      { cast_id: 'c1', recipient_id: 'r2', shared_by: 'u1' },
    ]);
    expect(opts).toEqual({ onConflict: 'cast_id,recipient_id', ignoreDuplicates: true });
  });

  it('does nothing when there are no recipients', async () => {
    const upsert = jest.fn();
    supabase.from.mockReturnValue({ upsert });

    await shareCast('c1', []);

    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('deleteCast', () => {
  it('deletes the cast row, then removes its audio object', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn(() => ({ eq }));
    const remove = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ delete: del });
    supabase.storage.from.mockReturnValue({ remove });

    await deleteCast('c1', 'u1/123.m4a');

    expect(supabase.from).toHaveBeenCalledWith('casts');
    expect(eq).toHaveBeenCalledWith('id', 'c1');
    expect(supabase.storage.from).toHaveBeenCalledWith('casts');
    expect(remove).toHaveBeenCalledWith(['u1/123.m4a']);
  });

  it('throws if the row delete fails, and skips storage cleanup', async () => {
    const eq = jest.fn().mockResolvedValue({ error: new Error('not allowed') });
    supabase.from.mockReturnValue({ delete: jest.fn(() => ({ eq })) });
    const remove = jest.fn();
    supabase.storage.from.mockReturnValue({ remove });

    await expect(deleteCast('c1', 'u1/123.m4a')).rejects.toThrow('not allowed');
    expect(remove).not.toHaveBeenCalled();
  });

  it('still resolves when the audio cleanup fails (orphan is harmless)', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ delete: jest.fn(() => ({ eq })) });
    supabase.storage.from.mockReturnValue({
      remove: jest.fn().mockRejectedValue(new Error('storage down')),
    });

    await expect(deleteCast('c1', 'u1/123.m4a')).resolves.toBeUndefined();
  });
});

describe('getAudioUrl (streaming a cast)', () => {
  it('returns a time-limited signed URL for the audio path', async () => {
    const createSignedUrl = jest
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://signed/audio.m4a' } });
    supabase.storage.from.mockReturnValue({ createSignedUrl });

    const url = await getAudioUrl('u1/123.m4a');

    expect(supabase.storage.from).toHaveBeenCalledWith('casts');
    expect(createSignedUrl).toHaveBeenCalledWith('u1/123.m4a', 3600);
    expect(url).toBe('https://signed/audio.m4a');
  });
});
