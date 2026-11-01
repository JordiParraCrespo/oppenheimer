import type { HostEntity } from '@oppenheimer/frontend-consumer';

/** What a row and the link picker need of a host: its name, and whether it is on. */
export interface WhatsappHost {
  id: string;
  name: string;
  online: boolean;
}

export function whatsappHostsOf(hosts: readonly HostEntity[]): WhatsappHost[] {
  return hosts.map((host) => ({ id: host.id, name: host.name, online: host.online }));
}
