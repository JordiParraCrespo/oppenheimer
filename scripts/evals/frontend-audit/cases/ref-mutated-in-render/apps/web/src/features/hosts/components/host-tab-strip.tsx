import { StatusDot } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useRef } from 'react';

/**
 * The hosts as tabs across the top of the terminal pane. A host that has been
 * online at least once while the pane was open keeps its dot lit, so a blip
 * in its heartbeat does not flicker the whole strip.
 */
export function HostTabStrip({
  hosts,
  activeId,
  onSelect,
}: {
  hosts: HostEntity[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const seenOnline = useRef(new Set<string>());
  for (const host of hosts) {
    if (host.online) seenOnline.current.add(host.id);
  }

  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto">
      {hosts.map((host) => (
        <button
          key={host.id}
          type="button"
          role="tab"
          aria-selected={host.id === activeId}
          onClick={() => onSelect(host.id)}
          className="flex items-center gap-1.5 px-2 py-1 text-fg"
        >
          <StatusDot state={seenOnline.current.has(host.id) ? 'running' : 'idle'}>
            {host.name}
          </StatusDot>
        </button>
      ))}
    </div>
  );
}
