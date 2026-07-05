// Relative time in words — "6 days ago", not the feed-app "6d". One shared
// implementation for cards, the cast detail page, and the inbox.
export function timeAgo(dateString) {
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return 'a minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;
  if (diffHr === 1) return 'an hour ago';
  if (diffHr < 24) return `${diffHr} hours ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffWeek === 1) return 'last week';
  return `${diffWeek} weeks ago`;
}
