import {
  AgentMark,
  ChipSelectActionRow,
  ChipSelectBack,
  ChipSelectHeading,
  ChipSelectItem,
  ChipSelectList,
  type ChipSelectOption,
  ChipSelectPopup,
  ChipSelectSearch,
  ChipSelectTrigger,
  dotVariants,
  Popover,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { ChevronRight } from '@oppenheimer/design-system-web/icons';
import type { CloudAgentProviderId } from '@oppenheimer/shared/schemas/cloud-agent';
import { SESSION_PLACES, type SessionPlace } from '@oppenheimer/shared/schemas/session';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  filterOptions,
  type PlaceCloud,
  type PlaceHost,
  toStartFromOptions,
} from '../lib/session-options';
import { ClaudeCloudItem } from './claude-cloud-item';
import { PlaceIcon } from './place-icon';

/** The Claude Code row's value: no host id or vendor id is spelled this way. */
const CLAUDE_CLOUD_ROW = 'claude-code-cloud';

/** What the list shows past the root: a host's places, or the hosts Claude Code's cloud starts from. */
type Pane = PlaceHost | typeof CLAUDE_CLOUD_ROW;

/**
 * The first chip of New session: where the session runs, read as one — a
 * host and where on it ("mac-studio · New worktree"), or a vendor's cloud
 * ("Cursor · Cloud") — as `NewSessionComposer.dc.html` draws it. The pane
 * lists the hosts under a Hosts heading with their count, each with its
 * presence dot and summary, and under a Cloud heading the vendors the console
 * launches a cloud session at, each with whose key it is (the frame's saved
 * environments are not built). A host opens its Start in pane, and picking
 * a place there picks the host with it
 * (`product/versions/mvp/24-session-places.md` §3). Claude Code cloud is a
 * place on a host: that host starts the task in the cloud with its own
 * `claude` (`product/research/cloud-agents.md` §5B). It is offered twice: in
 * each host's pane, and as the Claude Code row first under Cloud, which names
 * `claudeCloud`, the host the section above chose, and opens a Start from
 * pane of every host, the ones that cannot start it disabled with the reason;
 * with no host to start from it is greyed out (§7). A connected vendor is picked outright,
 * and one with no key yet goes to connect it. Add host… is the foot. Props
 * in, choices out: the section above fetches.
 *
 * Both panes are one list under one search: the hosts and the clouds, or the
 * host's places. The arrows move through it and Enter takes the row, as in
 * `ChipSelect`.
 *
 * A list that has not arrived is `loading`, not `disabled`: a greyed chip
 * reads as one this workspace may not use.
 */
export function PlaceSelect({
  hosts,
  hostId,
  place,
  claudeCloud,
  clouds,
  cloud,
  onHostChange,
  onPlaceChange,
  onCloudChange,
  onConnectCloud,
  onAddHost,
  loading,
  failure,
  disabled,
}: {
  hosts: PlaceHost[];
  hostId: string | null;
  place: SessionPlace;
  /** The host the Claude Code row starts its cloud session from; null greys the row out. */
  claudeCloud: PlaceHost | null;
  /** The vendors a cloud session can run on; none when this server keeps no keys. */
  clouds: PlaceCloud[];
  /** The vendor picked to launch the session at, with no host; null for a host's place. */
  cloud: CloudAgentProviderId | null;
  onHostChange: (hostId: string) => void;
  onPlaceChange: (place: SessionPlace) => void;
  onCloudChange: (provider: CloudAgentProviderId) => void;
  /** A vendor with no key yet: the reader goes to connect it. */
  onConnectCloud: () => void;
  onAddHost: () => void;
  loading?: boolean;
  failure?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const host = hosts.find((candidate) => candidate.value === hostId) ?? null;
  const atVendor = cloud !== null;
  const pickedCloud = atVendor
    ? (clouds.find((candidate) => candidate.value === cloud) ?? null)
    : null;
  const places: ChipSelectOption[] = SESSION_PLACES.map((candidate) => ({
    value: candidate,
    label: t(`sessions.new.where.${candidate}.label`),
    description: t(`sessions.new.where.${candidate}.description`),
    leading: <PlaceIcon place={candidate} />,
  }));
  // Searchable as the vendors are; `ClaudeCloudItem` draws it.
  const claudeRow: ChipSelectOption = {
    value: CLAUDE_CLOUD_ROW,
    label: t('sessions.new.where.claudeCloud.label'),
    description: claudeCloud?.label,
  };
  const term = query.trim().toLowerCase();
  const hostPane = pane === CLAUDE_CLOUD_ROW ? null : pane;
  const startFrom =
    pane === CLAUDE_CLOUD_ROW
      ? filterOptions(
          toStartFromOptions(hosts, {
            offline: t('sessions.new.host.offline'),
            cannot: t('sessions.new.where.claudeCloud.cannot'),
          }),
          term,
        )
      : [];
  // The root pane's rows are the hosts, then the clouds: one list, one index.
  // A loading host list has no host to start Claude Code's cloud from yet.
  const hostRows = pane ? [] : filterOptions<PlaceHost>(hosts, term);
  const cloudRows =
    pane || loading ? [] : filterOptions<ChipSelectOption>([claudeRow, ...clouds], term);
  const rows: ChipSelectOption[] = hostPane
    ? filterOptions<ChipSelectOption>(places, term)
    : pane
      ? startFrom
      : [...hostRows, ...cloudRows];

  function show(next: { pane?: Pane | null; query?: string }) {
    if (next.pane !== undefined) setPane(next.pane);
    setQuery(next.query ?? '');
    setActive(0);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) show({ pane: null });
  }

  /** A place on a host: from its pane, or Claude Code's cloud from the row under Cloud. */
  function pickPlace(target: PlaceHost, next: SessionPlace) {
    if (target.value !== hostId) onHostChange(target.value);
    // Also from a vendor: a host's place takes the session back to the host.
    if (next !== place || atVendor) onPlaceChange(next);
    onOpenChange(false);
  }

  function choose(row: ChipSelectOption) {
    if (hostPane) {
      const next = SESSION_PLACES.find((candidate) => candidate === row.value);
      if (next) pickPlace(hostPane, next);
      return;
    }
    if (pane) {
      const from = startFrom.find((candidate) => candidate.value === row.value);
      if (from && !from.disabled) pickPlace(from, 'cloud');
      return;
    }
    if (row.value === CLAUDE_CLOUD_ROW) {
      if (claudeCloud) show({ pane: CLAUDE_CLOUD_ROW });
      return;
    }
    const vendor = clouds.find((candidate) => candidate.value === row.value);
    if (vendor) {
      if (vendor.connected) onCloudChange(vendor.value);
      else onConnectCloud();
      onOpenChange(false);
      return;
    }
    const picked = hosts.find((candidate) => candidate.value === row.value);
    if (picked) show({ pane: picked });
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[active];
      if (row) choose(row);
    }
  }

  /** One row of the list, at its place in the one index the arrows walk. */
  function row(option: ChipSelectOption, index: number) {
    if (hostPane) {
      return (
        <ChipSelectItem
          key={option.value}
          selected={!atVendor && hostPane.value === hostId && option.value === place}
          highlighted={index === active}
          aria-label={option.label}
          leading={option.leading}
          description={option.description}
          onMouseEnter={() => setActive(index)}
          onClick={() => choose(option)}
        >
          {option.label}
        </ChipSelectItem>
      );
    }
    if (pane) {
      const from = startFrom.find((candidate) => candidate.value === option.value);
      return (
        <ChipSelectItem
          key={option.value}
          selected={!atVendor && place === 'cloud' && option.value === hostId}
          highlighted={index === active}
          disabled={from?.disabled}
          data-disabled={from?.disabled ? '' : undefined}
          aria-label={option.label}
          leading={<span className={dotVariants({ state: from?.online ? 'running' : 'idle' })} />}
          trailing={<span className="truncate text-xs text-fg-muted">{option.description}</span>}
          onMouseEnter={() => setActive(index)}
          onClick={() => choose(option)}
        >
          {option.label}
        </ChipSelectItem>
      );
    }
    if (option.value === CLAUDE_CLOUD_ROW) {
      return (
        <ClaudeCloudItem
          key={option.value}
          host={claudeCloud}
          selected={!atVendor && place === 'cloud'}
          highlighted={index === active}
          onMouseEnter={() => setActive(index)}
          onClick={() => choose(option)}
        />
      );
    }
    const vendor = clouds.find((candidate) => candidate.value === option.value);
    const machine = vendor ? null : hosts.find((candidate) => candidate.value === option.value);
    const chosen = vendor ? vendor.value === cloud : !atVendor && option.value === hostId;
    return (
      <ChipSelectItem
        key={option.value}
        selected={chosen}
        highlighted={index === active}
        aria-label={option.label}
        leading={
          vendor ? (
            <AgentMark agent={vendor.agent} />
          ) : (
            <span className={dotVariants({ state: machine?.online ? 'running' : 'idle' })} />
          )
        }
        trailing={
          <span className="flex min-w-0 shrink items-center gap-1.5 text-xs text-fg-muted">
            <span className="truncate">
              {chosen && !vendor ? t(`sessions.new.where.${place}.label`) : option.description}
            </span>
            {vendor ? null : <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" />}
          </span>
        }
        onMouseEnter={() => setActive(index)}
        onClick={() => choose(option)}
      >
        {option.label}
      </ChipSelectItem>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <ChipSelectTrigger
            icon={
              pickedCloud ? <AgentMark agent={pickedCloud.agent} /> : <PlaceIcon place={place} />
            }
            open={open}
            disabled={disabled}
            variant="tab"
            aria-label={t('sessions.new.host.label')}
          >
            {pickedCloud
              ? `${pickedCloud.label} · ${t('sessions.new.where.atVendor')}`
              : `${host?.label ?? t('sessions.new.host.placeholder')} · ${t(`sessions.new.where.${place}.label`)}`}
          </ChipSelectTrigger>
        }
      />
      <ChipSelectPopup width={320} maxHeight={420}>
        <ChipSelectSearch
          value={query}
          placeholder={t('sessions.new.host.search')}
          aria-label={t('sessions.new.host.search')}
          onChange={(event) => show({ query: event.target.value })}
          onKeyDown={onKeyDown}
        />
        {hostPane ? (
          <ChipSelectBack onClick={() => show({ pane: null })}>
            <span className="flex items-center gap-2">
              <span className={dotVariants({ state: hostPane.online ? 'running' : 'idle' })} />
              {hostPane.label}
              {hostPane.description ? (
                <span className="truncate text-fg-muted">{hostPane.description}</span>
              ) : null}
            </span>
          </ChipSelectBack>
        ) : pane ? (
          <ChipSelectBack onClick={() => show({ pane: null })}>
            <span className="flex items-center gap-2">
              <AgentMark agent="claude-code" />
              {t('sessions.new.where.claudeCloud.label')}
            </span>
          </ChipSelectBack>
        ) : null}
        <ChipSelectHeading>
          {hostPane ? (
            t('sessions.new.where.startIn')
          ) : pane ? (
            t('sessions.new.where.claudeCloud.startFrom')
          ) : (
            <>
              {t('sessions.new.where.hosts')}
              {loading ? null : <span className="figures ml-1.5">{hosts.length}</span>}
            </>
          )}
        </ChipSelectHeading>
        <ChipSelectList
          role="listbox"
          aria-label={t(hostPane ? 'sessions.new.where.label' : 'sessions.new.host.label')}
          loading={!pane && loading && cloudRows.length === 0}
          loadingText={t('sessions.new.host.loading')}
          empty={rows.length === 0}
          emptyText={failure ?? t('sessions.new.host.empty')}
        >
          {pane ? (
            rows.map(row)
          ) : (
            <>
              {hostRows.map(row)}
              {cloudRows.length > 0 ? (
                <>
                  <ChipSelectHeading>{t('sessions.new.where.clouds')}</ChipSelectHeading>
                  {cloudRows.map((option, index) => row(option, hostRows.length + index))}
                </>
              ) : null}
            </>
          )}
        </ChipSelectList>
        <ChipSelectActionRow
          action={{ label: t('sessions.new.host.add'), onSelect: onAddHost }}
          onClose={() => onOpenChange(false)}
        />
      </ChipSelectPopup>
    </Popover>
  );
}
