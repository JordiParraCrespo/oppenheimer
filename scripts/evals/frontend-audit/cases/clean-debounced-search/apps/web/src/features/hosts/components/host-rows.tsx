import { StatusDot } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';

/** The hosts whose name contains `query`, one row each. */
export function HostRows({ hosts, query }: { hosts: HostEntity[]; query: string }) {
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? hosts.filter((host) => host.name.toLowerCase().includes(needle))
    : hosts;

  return (
    <ul className="flex flex-col">
      {visible.map((host) => (
        <li key={host.id} className="flex items-center gap-2 py-1.5">
          <StatusDot state={host.online ? 'running' : 'idle'} />
          <span className="min-w-0 flex-1 truncate text-fg">{host.name}</span>
          <span className="figures text-fg-muted">{host.summary}</span>
        </li>
      ))}
    </ul>
  );
}
