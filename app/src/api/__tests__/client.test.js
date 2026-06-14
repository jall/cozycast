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

function mockFriendships(rows) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: rows }),
  };
}

function mockCasts(result) {
  return {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
  };
}

describe('getFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  });

  it('flattens joined profile data and falls back when a profile is missing', async () => {
    const casts = mockCasts({
      data: [
        { id: 'c1', title: 'A', profiles: { name: 'Alice', email: 'a@x.com' } },
        { id: 'c2', title: 'B', profiles: null },
      ],
      error: null,
    });
    supabase.from.mockImplementation((table) =>
      table === 'friendships' ? mockFriendships([{ friend_id: 'f1' }]) : casts,
    );

    const feed = await getFeed();

    expect(feed[0]).toMatchObject({ creator_name: 'Alice', creator_email: 'a@x.com' });
    expect(feed[1]).toMatchObject({ creator_name: 'Someone', creator_email: '' });
  });

  it('scopes the query to the user plus their friends', async () => {
    const casts = mockCasts({ data: [], error: null });
    supabase.from.mockImplementation((table) =>
      table === 'friendships' ? mockFriendships([{ friend_id: 'f1' }, { friend_id: 'f2' }]) : casts,
    );

    await getFeed();

    expect(casts.in).toHaveBeenCalledWith('creator_id', ['u1', 'f1', 'f2']);
  });

  it('throws when the casts query errors', async () => {
    const casts = mockCasts({ data: null, error: new Error('permission denied') });
    supabase.from.mockImplementation((table) =>
      table === 'friendships' ? mockFriendships([]) : casts,
    );

    await expect(getFeed()).rejects.toThrow('permission denied');
  });
});
