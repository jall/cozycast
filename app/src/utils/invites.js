import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SITE_URL } from '../config';

// Invite links. An invite is a single-use code (see the invites table); we
// hand it out as a plain URL — `https://cozycast.jall.me/invite/AB12CD` —
// because everyone knows what to do with a link. Opening one stashes the code
// on this device; once there's a session (straight away if you're signed in,
// or after you sign up / confirm / log in), usePendingInvite redeems it and
// you're connected. Connecting only adds each other to your address books — it
// never shares any casts.

const PENDING_KEY = 'cozycast.pendingInvite';

export function inviteLink(code) {
  return `${SITE_URL}/invite/${code}`;
}

// The invite code in a URL (`/invite/CODE` or `?invite=CODE`), or null.
export function inviteFromUrl(href) {
  if (!href) return null;
  let url;
  try {
    url = new URL(href, 'https://x.invalid');
  } catch {
    return null;
  }
  const path = url.pathname.match(/^\/invite\/([A-Za-z0-9]{4,32})\/?$/);
  const code = path ? path[1] : url.searchParams.get('invite');
  return code && /^[A-Za-z0-9]{4,32}$/.test(code) ? code.toUpperCase() : null;
}

export function savePendingInvite(code) {
  if (!code) return Promise.resolve();
  return AsyncStorage.setItem(PENDING_KEY, code.toUpperCase()).catch(() => {});
}

export function getPendingInvite() {
  return AsyncStorage.getItem(PENDING_KEY).catch(() => null);
}

export function clearPendingInvite() {
  return AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
}

// Web: if the page was opened from an invite link, stash the code and tidy the
// URL back to `/`. Call at module load. (The router may already have read the
// URL by then; the app/invite/[code] route redirects home for that case.)
export function captureInviteFromLocation() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const code = inviteFromUrl(window.location.href);
  if (!code) return null;
  savePendingInvite(code);
  try {
    window.history.replaceState(null, '', '/');
  } catch {
    // Leave the URL as is; the code is stashed either way.
  }
  return code;
}

// Share a link with the OS share sheet on touch devices (phones), else copy it
// — on a laptop a copied URL is what people expect. Resolves 'shared' |
// 'copied' | null (nothing happened).
export async function shareOrCopy(url, { title, text, copy }) {
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches;
  if (Platform.OS === 'web' && touch && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return null;
    }
  }
  try {
    await copy(url);
    return 'copied';
  } catch {
    return null;
  }
}
