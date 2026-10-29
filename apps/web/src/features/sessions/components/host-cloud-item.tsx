import { AgentMark, ChipSelectItem } from '@oppenheimer/design-system-web';
import { ChevronRight } from '@oppenheimer/design-system-web/icons';
import type { HostCloudAgentId } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { hostCloudCopy, type PlaceHost } from '../lib/session-options';

/**
 * A row of the place chip's Cloud tab for a cloud a host starts — Claude
 * Code's or Codex's: the agent's cloud started from `host`, which it names
 * ("From mac-studio"), and a way into the Start from pane where the reader
 * picks another. With no host that can start it the row is greyed out as
 * Needs a host, as `NewSessionComposer.dc.html` draws a cloud account that
 * cannot run (`product/versions/mvp/24-session-places.md` §7).
 */
export function HostCloudItem({
  agent,
  host,
  selected,
  highlighted,
  onMouseEnter,
  onClick,
}: {
  agent: HostCloudAgentId;
  host: PlaceHost | null;
  selected: boolean;
  highlighted: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const copy = hostCloudCopy(agent).where;
  const label = t(copy.label);
  return (
    <ChipSelectItem
      selected={selected}
      highlighted={highlighted}
      disabled={!host}
      data-disabled={host ? undefined : ''}
      aria-label={label}
      leading={<AgentMark agent={agent} />}
      trailing={
        <span className="flex min-w-0 shrink items-center gap-1.5 text-xs text-fg-muted">
          <span className="truncate">
            {host ? t(copy.from, { host: host.label }) : t(copy.noHost)}
          </span>
          {host ? <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" /> : null}
        </span>
      }
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {label}
    </ChipSelectItem>
  );
}
