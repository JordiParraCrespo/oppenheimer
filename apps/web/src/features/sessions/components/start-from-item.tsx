import { ChipSelectItem, dotVariants } from '@oppenheimer/design-system-web';
import type { StartFromHost } from '../lib/session-options';

/**
 * One host in a host cloud's Start from pane: its presence dot, its name,
 * and either the account it would run the session on (the claude.ai one,
 * for Claude Code), what the host is, or why it cannot start one, in which
 * case the row is disabled.
 */
export function StartFromItem({
  host,
  selected,
  onClick,
}: {
  host: StartFromHost;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <ChipSelectItem
      selected={selected}
      disabled={host.disabled}
      data-disabled={host.disabled ? '' : undefined}
      aria-label={host.label}
      leading={<span className={dotVariants({ state: host.online ? 'running' : 'idle' })} />}
      trailing={<span className="truncate text-xs text-fg-muted">{host.description}</span>}
      onClick={onClick}
    >
      {host.label}
    </ChipSelectItem>
  );
}
