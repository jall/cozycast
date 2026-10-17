import { Redirect } from 'expo-router';

// /invite/:code — the code was already stashed when the page loaded (see
// utils/invites, called from app/_layout.js) and is redeemed by
// usePendingInvite, so this route only needs to land you on the home screen.
export default function InviteRoute() {
  return <Redirect href="/" />;
}
