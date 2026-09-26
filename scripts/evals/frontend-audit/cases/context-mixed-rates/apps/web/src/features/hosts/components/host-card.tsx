import { Card, StatusDot } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useHostView } from '../hooks/use-host-view';

/** One host: its name, whether it is online, and what it runs on. */
export function HostCard({ host }: { host: HostEntity }) {
  const { density, hoveredId, setHoveredId } = useHostView();
  const dimmed = hoveredId !== null && hoveredId !== host.id;

  return (
    <Card
      padded={density === 'comfortable'}
      data-dimmed={dimmed || undefined}
      onPointerEnter={() => setHoveredId(host.id)}
      onPointerLeave={() => setHoveredId(null)}
    >
      <StatusDot state={host.online ? 'running' : 'idle'} meta={host.summary}>
        {host.name}
      </StatusDot>
    </Card>
  );
}
