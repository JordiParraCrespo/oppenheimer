import { ChipSelectItem, dotVariants } from '@oppenheimer/design-system-web';
import type { StartFromHost } from '../lib/session-options';

/**
 * One host in the Claude Code row's Start from pane: its presence dot, its
 * name, and either the claude.ai account it would run the session on or why
 * it cannot start one, in which case the row is disabled
 * (`product/versions/mvp/24-session-places.md` §7).
 */
export function StartFromItem({
  host,
  selected,
  highlighted,
  onMouseEnter,
  onClick,
}: {
  host: StartFromHost;
  selected: boolean;
  highlighted: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <ChipSelectItem
      selected={selected}
      highlighted={highlighted}
      disabled={host.disabled}
      data-disabled={host.disabled ? '' : undefined}
      aria-label={host.label}
      leading={<span className={dotVariants({ state: host.online ? 'running' : 'idle' })} />}
      trailing={<span className="truncate text-xs text-fg-muted">{host.description}</span>}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {host.label}
    </ChipSelectItem>
  );
}
