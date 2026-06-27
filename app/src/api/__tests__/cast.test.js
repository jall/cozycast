import { supabase } from '../supabase';
import {
  createCast,
  shareCast,
  getAudioUrl,
  deleteCast,
  getCast,
  removeRecipient,
  getComments,
  addComment,
  deleteComment,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  markPlayed,
} from '../client';

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

describe('removeRecipient', () => {
  it('deletes the recipient row for the cast', async () => {
    const eqRecipient = jest.fn().mockResolvedValue({ error: null });
    const eqCast = jest.fn(() => ({ eq: eqRecipient }));
    supabase.from.mockReturnValue({ delete: jest.fn(() => ({ eq: eqCast })) });

    await removeRecipient('c1', 'r1');

    expect(supabase.from).toHaveBeenCalledWith('cast_recipients');
    expect(eqCast).toHaveBeenCalledWith('cast_id', 'c1');
    expect(eqRecipient).toHaveBeenCalledWith('recipient_id', 'r1');
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

describe('getCast (detail page / deep link)', () => {
  function mockSingleRow(row) {
    const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
    const eq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ select });
    return { select, eq, maybeSingle };
  }

  it('returns a flattened cast, marking ones I created as not shared-with-me', async () => {
    const { eq } = mockSingleRow({
      id: 'c1',
      title: 'Bread talk',
      creator: { id: 'u1', name: 'Me', email: 'me@x.com' },
      sharer: null,
      cast_participants: [{ profile_id: 'p1', name: 'Ben' }],
      cast_recipients: [{ recipient_id: 'r1' }],
    });

    const cast = await getCast('c1');

    expect(eq).toHaveBeenCalledWith('id', 'c1');
    expect(cast).toMatchObject({
      id: 'c1',
      creator_name: 'Me',
      participants: ['Ben'],
      recipient_count: 1,
      shared_with_me: false,
    });
  });

  it('marks a cast created by someone else as shared-with-me', async () => {
    mockSingleRow({
      id: 'c2',
      title: 'Theirs',
      creator: { id: 'u2', name: 'Ada', email: 'ada@x.com' },
      sharer: { id: 'u2', name: 'Ada' },
      cast_participants: [],
      cast_recipients: [],
    });

    const cast = await getCast('c2');
    expect(cast.shared_with_me).toBe(true);
    expect(cast.sharer_name).toBe('Ada');
    expect(cast.can_manage).toBe(false);
  });

  it('lets an assigned sharer manage even though the cast is shared with them', async () => {
    mockSingleRow({
      id: 'c3',
      title: 'Assigned to me',
      creator: { id: 'u2', name: 'Ben' },
      sharer: { id: 'u1', name: 'Me' },
      sharer_id: 'u1',
      cast_participants: [],
      cast_recipients: [],
    });

    const cast = await getCast('c3');
    expect(cast.shared_with_me).toBe(true); // creator isn't me
    expect(cast.can_manage).toBe(true); // but I'm the assigned sharer
  });

  it('returns null when no row is visible (RLS) or it does not exist', async () => {
    mockSingleRow(null);
    await expect(getCast('missing')).resolves.toBeNull();
  });
});

describe('comments', () => {
  it('getComments flattens rows and flags the current user’s own', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        { id: 'cm1', body: 'hi', created_at: 't1', author: { id: 'u2', name: 'Ben' } },
        { id: 'cm2', body: 'me', created_at: 't2', author: { id: 'u1', name: 'Me' } },
      ],
      error: null,
    });
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ select });

    const out = await getComments('c1');

    expect(supabase.from).toHaveBeenCalledWith('cast_comments');
    expect(eq).toHaveBeenCalledWith('cast_id', 'c1');
    expect(out[0]).toMatchObject({ id: 'cm1', author_name: 'Ben', author_id: 'u2', mine: false });
    expect(out[1]).toMatchObject({ id: 'cm2', author_name: 'Me', mine: true });
  });

  it('addComment inserts as the current user and returns the mapped comment', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id: 'cm9', body: 'yo', created_at: 't', author: { id: 'u1', name: 'Me' } },
      error: null,
    });
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    supabase.from.mockReturnValue({ insert });

    const c = await addComment('c1', 'yo');

    expect(insert).toHaveBeenCalledWith({ cast_id: 'c1', author_id: 'u1', body: 'yo' });
    expect(c).toMatchObject({ id: 'cm9', body: 'yo', author_name: 'Me', mine: true });
  });

  it('deleteComment removes by id (RLS enforces author/manager)', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ delete: jest.fn(() => ({ eq })) });

    await deleteComment('cm1');

    expect(supabase.from).toHaveBeenCalledWith('cast_comments');
    expect(eq).toHaveBeenCalledWith('id', 'cm1');
  });

  it('deleteComment throws when the delete is refused', async () => {
    const eq = jest.fn().mockResolvedValue({ error: new Error('not allowed') });
    supabase.from.mockReturnValue({ delete: jest.fn(() => ({ eq })) });

    await expect(deleteComment('cm1')).rejects.toThrow('not allowed');
  });
});

describe('notifications', () => {
  it('getNotifications flattens actor + cast and a read flag', async () => {
    const limit = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'n1',
          type: 'comment',
          cast_id: 'c1',
          created_at: 't',
          read_at: null,
          actor: { name: 'Ben' },
          cast: { title: 'Kitchen' },
        },
      ],
      error: null,
    });
    const order = jest.fn(() => ({ limit }));
    const select = jest.fn(() => ({ order }));
    supabase.from.mockReturnValue({ select });

    const out = await getNotifications();

    expect(supabase.from).toHaveBeenCalledWith('notifications');
    expect(out[0]).toMatchObject({
      id: 'n1',
      type: 'comment',
      cast_title: 'Kitchen',
      actor_name: 'Ben',
      read: false,
    });
  });

  it('getUnreadNotificationCount counts unread rows', async () => {
    const is = jest.fn().mockResolvedValue({ count: 3, error: null });
    const select = jest.fn(() => ({ is }));
    supabase.from.mockReturnValue({ select });

    expect(await getUnreadNotificationCount()).toBe(3);
    expect(is).toHaveBeenCalledWith('read_at', null);
  });

  it('markNotificationsRead stamps read_at on my unread rows', async () => {
    const is = jest.fn().mockResolvedValue({ error: null });
    const eq = jest.fn(() => ({ is }));
    const update = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ update });

    await markNotificationsRead();

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ read_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(is).toHaveBeenCalledWith('read_at', null);
  });
});

describe('markPlayed', () => {
  it('upserts a play row for the current user (first play wins)', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ upsert });

    await markPlayed('c1');

    expect(supabase.from).toHaveBeenCalledWith('cast_plays');
    const [row, opts] = upsert.mock.calls[0];
    expect(row).toEqual({ cast_id: 'c1', user_id: 'u1' });
    expect(opts).toEqual({ onConflict: 'cast_id,user_id', ignoreDuplicates: true });
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
