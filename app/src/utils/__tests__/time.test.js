import { timeAgo } from '../time';

function ago(ms) {
  return new Date(Date.now() - ms).toISOString();
}

const MIN = 60 * 1000;
const HR = 60 * MIN;
const DAY = 24 * HR;

describe('timeAgo', () => {
  it('speaks in words, not feed-app shorthand', () => {
    expect(timeAgo(ago(10 * 1000))).toBe('just now');
    expect(timeAgo(ago(MIN))).toBe('a minute ago');
    expect(timeAgo(ago(20 * MIN))).toBe('20 minutes ago');
    expect(timeAgo(ago(HR))).toBe('an hour ago');
    expect(timeAgo(ago(5 * HR))).toBe('5 hours ago');
    expect(timeAgo(ago(DAY))).toBe('yesterday');
    expect(timeAgo(ago(3 * DAY))).toBe('3 days ago');
    expect(timeAgo(ago(8 * DAY))).toBe('last week');
    expect(timeAgo(ago(21 * DAY))).toBe('3 weeks ago');
  });
});
