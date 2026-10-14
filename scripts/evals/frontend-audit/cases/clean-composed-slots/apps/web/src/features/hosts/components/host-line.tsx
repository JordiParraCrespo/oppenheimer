import { StatusDot } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import type { ReactNode } from 'react';

/** A host in one line: its dot and summary, then whatever facts the caller puts after them. */
export function HostLine({ host, children }: { host: HostEntity; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <StatusDot state={host.online ? 'running' : 'idle'} className="min-w-0 flex-1">
        {host.summary}
      </StatusDot>
      {children}
    </div>
  );
}
