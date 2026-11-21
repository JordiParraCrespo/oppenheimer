import { useSessionRestore, useSocialLogin } from '@oppenheimer/frontend-core/react';

/**
 * Social sign-in as a phone does it. On the web the provider round-trip ends
 * on a fresh page load, which restores the session; here it ends back in the
 * app, so nothing would re-read the session the Expo client just stored and
 * the route guards would keep the person signed out. This reads it once the
 * round-trip resolves. A cancelled browser resolves too, but finds no session,
 * so `onSignedIn` runs only for a finished sign-in.
 */
export function useSocialSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const session = useSessionRestore({ enabled: false });

  return useSocialLogin({
    onSuccess: async () => {
      const { data: userId } = await session.refetch();
      if (userId) onSignedIn?.();
    },
  });
}
