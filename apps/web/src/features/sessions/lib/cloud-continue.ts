import type { HostEntity } from '@oppenheimer/frontend-consumer';

/**
 * Where a cloud session is continued when the reader picks no host: the host
 * that started it while it is online, else the first online host. Undefined
 * when none is online, since a session on an offline host would only queue.
 */
export function continueHost(
  hosts: readonly HostEntity[],
  startedOn: string | null,
): HostEntity | undefined {
  const online = hosts.filter((host) => host.online);
  return online.find((host) => host.id === startedOn) ?? online[0];
}
