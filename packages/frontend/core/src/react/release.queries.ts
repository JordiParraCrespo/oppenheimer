'use client';

import { CORE_CONFIG } from '../config';
import { useOppenheimerApp } from './context';
import { useSuspenseQuery } from './query';

const releaseKeys = {
  all: ['release'] as const,
  apiVersion: () => [...releaseKeys.all, 'api-version'] as const,
};

/**
 * The release the API runs, from `GET /health/version`, for Settings → About.
 * Read under Suspense: the kit's `QueryState` draws its loading and first
 * failure. It changes only on a redeploy, so it stays fresh as long as the
 * deployment's capabilities do.
 */
export function useSuspenseApiVersion() {
  const app = useOppenheimerApp();

  return useSuspenseQuery({
    queryKey: releaseKeys.apiVersion(),
    queryFn: () => app.release.getApiVersion(),
    staleTime: CORE_CONFIG.query.capabilitiesStaleMs,
  });
}
