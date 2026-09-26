import { useHosts } from '@oppenheimer/frontend-consumer/react';

/**
 * How many hosts the workspace has: what the settings layout answers the
 * sidebar's count slot with for the Hosts row. A section of one number: it
 * subscribes to the length and nothing else, so a refetch that changes no
 * count re-renders nothing, and the nav around it never reads the list.
 * Nothing while the list is unanswered — a zero under a request that has not
 * answered reads as "you have none".
 */
export function HostCount() {
  const { data: count } = useHosts({ select: (hosts) => hosts.length });
  return count === undefined ? null : count;
}
