import type { HostEntity } from '@oppenheimer/frontend-consumer';
import type { ReactNode } from 'react';

/**
 * The hosts, online ones first. Each host is drawn by `children`, which gets
 * the host it draws: the order is this component's, the row is the caller's.
 */
export function HostsByPresence({
  hosts,
  children,
}: {
  hosts: HostEntity[];
  children: (host: HostEntity) => ReactNode;
}) {
  const ordered = [...hosts].sort((a, b) => Number(b.online) - Number(a.online));
  return <>{ordered.map((host) => children(host))}</>;
}
