import { useHosts } from '@oppenheimer/frontend-consumer/react';

/**
 * How many hosts the workspace has: what the settings layout answers the
 * sidebar's count slot with for the Hosts row. A section of one number: it
 * subscribes to the length and nothing else, so a refetch that changes no
 * count re-renders nothing, and the nav around it never reads the list. It
 * starts at zero so the slot is never empty.
 */
export function HostCount() {
  const { data: count } = useHosts({ select: (hosts) => hosts.length });
  return count ?? 0;
}
