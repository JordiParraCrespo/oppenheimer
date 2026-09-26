import { Card, StatusDot } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useHostView } from '../hooks/use-host-view';

/** One host: its name, whether it is online, and what it runs on. */
export function HostCard({ host }: { host: HostEntity }) {
  const { density, hoveredId, setHoveredId } = useHostView();
  const dimmed = hoveredId !== null && hoveredId !== host.id;

  return (
    <Card
      size={density === 'compact' ? 'sm' : 'default'}
      data-dimmed={dimmed || undefined}
      onPointerEnter={() => setHoveredId(host.id)}
      onPointerLeave={() => setHoveredId(null)}
    >
      <div className="flex items-center gap-2">
        <StatusDot state={host.online ? 'running' : 'idle'} />
        <span className="truncate text-fg">{host.name}</span>
      </div>
      <span className="text-fg-muted">{host.summary}</span>
    </Card>
  );
}
