// The public site URL: where email links return to, and the base for links we
// hand out (invites). Must also be allow-listed in the Supabase dashboard
// (Authentication → URL Configuration). Overridable via EXPO_PUBLIC_SITE_URL.
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://cozycast.jall.me').replace(
  /\/+$/,
  '',
);
