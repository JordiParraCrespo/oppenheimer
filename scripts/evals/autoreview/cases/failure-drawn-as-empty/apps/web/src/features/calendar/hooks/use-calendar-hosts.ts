import { useHosts } from '@oppenheimer/frontend-consumer/hosts';

/**
 * The hosts the calendar lays its runs on, one lane each. A workspace with no
 * hosts gets an empty calendar with the "Connect a host" prompt.
 */
export function useCalendarHosts() {
  const hosts = useHosts();
  const lanes = (hosts.data ?? []).map((host) => ({ id: host.id, label: host.name }));
  return { lanes, loading: hosts.isPending, empty: !hosts.isPending && lanes.length === 0 };
}
