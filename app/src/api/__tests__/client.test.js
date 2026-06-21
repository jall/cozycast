import { supabase } from '../supabase';
import { getFeed } from '../client';

// Mock the supabase client module so these tests exercise the data-shaping
// logic in client.js without touching the network.
jest.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

function mockCasts(result) {
  return {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
  };
}

describe('getFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  });

  it('flattens creator, sharer, participants and recipients', async () => {
    const casts = mockCasts({
      data: [
        {
          id: 'c1',
          title: 'A',
          sharer_id: 'f1',
          creator: { id: 'f1', name: 'Alice', email: 'a@x.com' },
          sharer: { id: 'f1', name: 'Alice' },
          cast_participants: [{ profile_id: 'p1', name: 'Bob' }],
          cast_recipients: [{ recipient_id: 'u1' }],
        },
      ],
      error: null,
    });
    supabase.from.mockReturnValue(casts);

    const feed = await getFeed();

    expect(feed[0]).toMatchObject({
      creator_name: 'Alice',
      sharer_name: 'Alice',
      participants: ['Bob'],
      recipient_count: 1,
      shared_with_me: true,
    });
  });

  it('falls back gracefully when a profile is missing', async () => {
    const casts = mockCasts({
      data: [{ id: 'c2', title: 'B', creator: null, sharer: null }],
      error: null,
    });
    supabase.from.mockReturnValue(casts);

    const feed = await getFeed();

    expect(feed[0]).toMatchObject({
      creator_name: 'Someone',
      creator_email: '',
      participants: [],
      recipient_count: 0,
    });
  });

  it('marks the viewer’s own casts as not shared_with_me', async () => {
    const casts = mockCasts({
      data: [{ id: 'c3', title: 'Mine', creator: { id: 'u1', name: 'Me' }, sharer: { id: 'u1' } }],
      error: null,
    });
    supabase.from.mockReturnValue(casts);

    const feed = await getFeed();

    expect(feed[0].shared_with_me).toBe(false);
  });

  it('throws when the casts query errors', async () => {
    const casts = mockCasts({ data: null, error: new Error('permission denied') });
    supabase.from.mockReturnValue(casts);

    await expect(getFeed()).rejects.toThrow('permission denied');
  });
});
