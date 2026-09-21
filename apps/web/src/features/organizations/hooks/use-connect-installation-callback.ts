import { useConnectInstallation } from '@oppenheimer/frontend-consumer/react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

/**
 * Exchange the `installation_id` and `code` GitHub put on the return leg.
 *
 * The effect synchronises with the URL — the one system React does not own
 * here. It runs once per code: `exchanged` guards against React's double
 * invoke in development and against a re-render mid-flight, because the code
 * is one-shot and a second POST with it fails.
 *
 * The parameters are stripped on both outcomes. On success they are spent; on
 * failure they are still spent, and leaving them in the address bar means a
 * refresh retries an exchange that can only fail again, burying the real error
 * under a second one.
 */
export function useConnectInstallationCallback(installationId?: number, code?: string) {
  const navigate = useNavigate();
  const { mutate, isPending, error } = useConnectInstallation();
  const exchanged = useRef<string | null>(null);

  useEffect(() => {
    if (!installationId || !code) return;
    if (exchanged.current === code) return;
    exchanged.current = code;

    const clearCallbackParams = () =>
      navigate({
        to: '/onboarding/github',
        search: {},
        replace: true,
      });

    mutate(
      { githubInstallationId: installationId, code },
      { onSuccess: clearCallbackParams, onError: clearCallbackParams },
    );
  }, [installationId, code, mutate, navigate]);

  return {
    /** True while the code is being exchanged, so the step can hold its place. */
    isExchanging: isPending,
    error,
  };
}
