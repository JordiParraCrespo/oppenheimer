import { SessionFilterChips } from '../../sessions/components/session-filter-chips';

/** The hosts page reuses the sessions sidebar's chips to show its active filter. */
export function HostSidebar({ label, onClear }: { label: string; onClear: () => void }) {
  return <SessionFilterChips chips={[{ key: 'host', label }]} onClear={() => onClear()} />;
}
