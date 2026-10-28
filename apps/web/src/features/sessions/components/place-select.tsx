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
import { filterOptions, type PlaceCloud, type PlaceHost } from '../lib/session-options';
import { PlaceIcon } from './place-icon';

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
 * `claude` (`product/research/cloud-agents.md` §5B). A connected vendor is
 * picked outright, and one with no key yet goes to connect it. Add host… is
 * the foot. Props in, choices out: the section above fetches.
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
  const [pane, setPane] = useState<PlaceHost | null>(null);
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
  const term = query.trim().toLowerCase();
  // The root pane's rows are the hosts, then the clouds: one list, one index.
  const hostRows = pane ? [] : filterOptions<PlaceHost>(hosts, term);
  const cloudRows = pane ? [] : filterOptions<PlaceCloud>(clouds, term);
  const rows: ChipSelectOption[] = pane
    ? filterOptions<ChipSelectOption>(places, term)
    : [...hostRows, ...cloudRows];

  function show(next: { pane?: PlaceHost | null; query?: string }) {
    if (next.pane !== undefined) setPane(next.pane);
    setQuery(next.query ?? '');
    setActive(0);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) show({ pane: null });
  }

  function choose(row: ChipSelectOption) {
    if (!pane) {
      const vendor = clouds.find((candidate) => candidate.value === row.value);
      if (vendor) {
        if (vendor.connected) onCloudChange(vendor.value);
        else onConnectCloud();
        onOpenChange(false);
        return;
      }
      const picked = hosts.find((candidate) => candidate.value === row.value);
      if (picked) show({ pane: picked });
      return;
    }
    const next = SESSION_PLACES.find((candidate) => candidate === row.value);
    if (!next) return;
    if (pane.value !== hostId) onHostChange(pane.value);
    // Also from a vendor: a host's place takes the session back to the host.
    if (next !== place || atVendor) onPlaceChange(next);
    onOpenChange(false);
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
    if (pane) {
      return (
        <ChipSelectItem
          key={option.value}
          selected={!atVendor && pane.value === hostId && option.value === place}
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
        {pane ? (
          <ChipSelectBack onClick={() => show({ pane: null })}>
            <span className="flex items-center gap-2">
              <span className={dotVariants({ state: pane.online ? 'running' : 'idle' })} />
              {pane.label}
              {pane.description ? (
                <span className="truncate text-fg-muted">{pane.description}</span>
              ) : null}
            </span>
          </ChipSelectBack>
        ) : null}
        <ChipSelectHeading>
          {pane ? (
            t('sessions.new.where.startIn')
          ) : (
            <>
              {t('sessions.new.where.hosts')}
              {loading ? null : <span className="figures ml-1.5">{hosts.length}</span>}
            </>
          )}
        </ChipSelectHeading>
        <ChipSelectList
          role="listbox"
          aria-label={t(pane ? 'sessions.new.where.label' : 'sessions.new.host.label')}
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
