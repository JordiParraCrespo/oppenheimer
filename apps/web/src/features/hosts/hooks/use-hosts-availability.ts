import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';

/**
 * Whether this deployment can pair a machine, as `GET /health/capabilities`
 * reports it (`hosts`).
 *
 * Every pairing surface asks before it mounts the flow: the flow mints a token
 * on mount, and on a server with no runner releases configured every mint
 * answers `HOSTS_004`, which used to leave a red error over a wait that could
 * never end.
 *
 * - `checking` until the first answer, so nothing mints in the meantime.
 * - `unavailable` only on an explicit `false`.
 * - `available` otherwise, a failed read included: an unreachable API is not
 *   a deployment without hosts, and the flow says so itself when it mints.
 */
export type HostsAvailability = 'checking' | 'available' | 'unavailable';

export function useHostsAvailability(): HostsAvailability {
  const { data: hosts, isPending } = useDeploymentCapabilities({
    select: (deployment) => deployment.hosts,
  });

  if (hosts === false) return 'unavailable';
  if (isPending) return 'checking';
  return 'available';
}
