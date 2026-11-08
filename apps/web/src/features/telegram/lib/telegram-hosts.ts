import type { HostEntity } from '@oppenheimer/frontend-consumer';

/** What a row and the connect picker need of a host: its name, and whether it is on. */
export interface TelegramHost {
  id: string;
  name: string;
  online: boolean;
}

export function telegramHostsOf(hosts: readonly HostEntity[]): TelegramHost[] {
  return hosts.map((host) => ({ id: host.id, name: host.name, online: host.online }));
}
