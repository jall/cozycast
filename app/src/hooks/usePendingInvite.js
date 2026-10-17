import { useEffect } from 'react';
import { redeemInvite } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useShell } from '../context/ShellContext';
import { getPendingInvite, clearPendingInvite } from '../utils/invites';

// Once signed in, redeem an invite link this device was opened with (see
// utils/invites) and say who you're now connected with.
export default function usePendingInvite() {
  const toast = useToast();
  const { bumpFriends } = useShell();

  useEffect(() => {
    let live = true;
    (async () => {
      const code = await getPendingInvite();
      if (!code) return;
      await clearPendingInvite();
      try {
        const name = await redeemInvite(code);
        if (!live) return;
        bumpFriends();
        toast.success(
          name
            ? `You’re connected with ${name} — they’re around your fire now.`
            : 'You’re connected — they’re around your fire now.',
        );
      } catch (err) {
        if (!live) return;
        const own = /own invite/i.test(err?.message || '');
        toast.error(
          own
            ? 'That’s your own invite link — send it to someone else.'
            : 'That invite link has already been used. Ask for a fresh one.',
        );
      }
    })();
    return () => {
      live = false;
    };
  }, [toast, bumpFriends]);
}
