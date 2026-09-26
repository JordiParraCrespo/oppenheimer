import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { HostCard } from '../components/host-card';
import { type HostDensity, HostViewContext } from '../hooks/use-host-view';

/**
 * Every host as a card. The card under the pointer is highlighted and its
 * neighbours dim, so the board needs to know which one that is.
 */
export function HostBoard({ density }: { density: HostDensity }) {
  const { data: hosts } = useHosts();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <HostViewContext value={{ density, hoveredId, setHoveredId }}>
      <div className="grid grid-cols-3 gap-3">
        {(hosts ?? []).map((host) => (
          <HostCard key={host.id} host={host} />
        ))}
      </div>
    </HostViewContext>
  );
}
