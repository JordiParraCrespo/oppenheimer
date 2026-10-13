import { StatusDot } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';

/** A host as a chip in the strip: its dot and its name, small. */
export function HostChip({ host }: { host: HostEntity }) {
  return (
    <StatusDot state={host.online ? 'running' : 'idle'} density="compact">
      {host.name}
    </StatusDot>
  );
}
