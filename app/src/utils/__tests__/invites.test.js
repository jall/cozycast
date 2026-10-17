import { inviteFromUrl, inviteLink } from '../invites';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('invite links', () => {
  it('builds a plain URL from a code', () => {
    expect(inviteLink('AB12CD')).toBe('https://cozycast.jall.me/invite/AB12CD');
  });

  it('reads the code back out of a link, either shape', () => {
    expect(inviteFromUrl('https://cozycast.jall.me/invite/ab12cd')).toBe('AB12CD');
    expect(inviteFromUrl('https://cozycast.jall.me/invite/AB12CD/')).toBe('AB12CD');
    expect(inviteFromUrl('https://cozycast.jall.me/?invite=AB12CD')).toBe('AB12CD');
  });

  it('ignores anything that is not an invite', () => {
    expect(inviteFromUrl('https://cozycast.jall.me/')).toBeNull();
    expect(inviteFromUrl('https://cozycast.jall.me/cast/123')).toBeNull();
    expect(inviteFromUrl('https://cozycast.jall.me/invite/<script>')).toBeNull();
    expect(inviteFromUrl('')).toBeNull();
  });
});
