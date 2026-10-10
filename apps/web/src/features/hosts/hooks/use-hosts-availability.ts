import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';

/**
 * Whether this deployment can pair a machine, as `GET /health/capabilities`
 * reports it (`hosts`). Pairing mints on mount, so a surface mints only once
 * this says `available`.
 *
 * - `checking` until this mount has an answer of its own. A cached `true`
 *   (persisted, or from before a restart) is not enough: the server may have
 *   lost its runner release settings since, so this refetches on mount.
 * - `unavailable` only on an explicit `false`.
 * - `available` otherwise, a failed read included: an unreachable API is not
 *   a deployment without hosts, and the flow reports its own error when it
 *   mints.
 */
export type HostsAvailability = 'checking' | 'available' | 'unavailable';

export function useHostsAvailability(): HostsAvailability {
  const { data: hosts, isFetchedAfterMount } = useDeploymentCapabilities({
    select: (deployment) => deployment.hosts,
    refetchOnMount: 'always',
  });

  if (!isFetchedAfterMount) return 'checking';
  return hosts === false ? 'unavailable' : 'available';
}
