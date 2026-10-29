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
  ChipSelectTab,
  ChipSelectTabs,
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
  type StartFromHost,
} from '../lib/session-options';
import { ClaudeCloudItem } from './claude-cloud-item';
import { PlaceIcon } from './place-icon';
import { StartFromItem } from './start-from-item';

/** The Claude Code row's value: no host id or vendor id is spelled this way. */
const CLAUDE_CLOUD_ROW = 'claude-code-cloud';

/**
 * What the list shows: the hosts and the clouds, a host's places, or the
 * hosts Claude Code's cloud starts from. Each kind has its rows, its pick,
 * its row and its heading, chosen once by `pane.kind`.
 */
type Pane = { kind: 'root' } | { kind: 'host'; host: PlaceHost } | { kind: 'start-from' };

const ROOT: Pane = { kind: 'root' };

/** The root's two lists, a tab each: the hosts, and the clouds. */
type Tab = 'hosts' | 'cloud';

/**
 * The first chip of New session: where the session runs, read as one — a
 * host and where on it ("mac-studio · New worktree"), or a vendor's cloud
 * ("Cursor · Cloud") — as `NewSessionComposer.dc.html` draws it. The pane
 * is two tabs under the search, each with its count: Hosts, each with its
 * presence dot and summary, and Cloud, the vendors the console launches a
 * cloud session at, each with whose key it is (the frame's third tab, saved
 * environments, is not built). It opens on the tab of what is picked. A host opens its Start in pane, and picking
 * a place there picks the host with it
 * (`product/versions/mvp/24-session-places.md` §3). Claude Code cloud is a
 * place on a host: that host starts the task in the cloud with its own
 * `claude` (`product/research/cloud-agents.md` §5B). It is offered twice: in
 * each host's pane, and as the Claude Code row first under Cloud, which names
 * `claudeCloud`, the host the section above chose, and opens a Start from
 * pane of `startFrom`, every host as the section above judged it, the ones
 * that cannot start it disabled with the reason; with no host to start from
 * it is greyed out (§7). A connected vendor is picked outright,
 * and one with no key yet goes to connect it. Add host… is the foot. Props
 * in, choices out: the section above fetches.
 *
 * Each pane is one list under one search: the tab's hosts or clouds, a host's
 * places, or the hosts to start from. The arrows move through it and Enter
 * takes the row, as in `ChipSelect`.
 *
 * A list that has not arrived is `loading`, not `disabled`: a greyed chip
 * reads as one this workspace may not use.
 */
export function PlaceSelect({
  hosts,
  hostId,
  place,
  claudeCloud,
  startFrom,
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
  /** The Claude Code row's Start from pane: every host, each saying whether it can and why not. */
  startFrom: StartFromHost[];
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
  const [pane, setPane] = useState<Pane>(ROOT);
  const [tab, setTab] = useState<Tab>('hosts');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const host = hosts.find((candidate) => candidate.value === hostId) ?? null;
  const atVendor = cloud !== null;
  const pickedCloud = atVendor
    ? (clouds.find((candidate) => candidate.value === cloud) ?? null)
    : null;
  const term = query.trim().toLowerCase();

  // Both tabs filter under the one search, so each tab's count says what it
  // holds; the rows are the open tab's. A loading host list has no host to
  // start Claude Code's cloud from yet.
  const hostRows = pane.kind === 'root' ? filterOptions<PlaceHost>(hosts, term) : [];
  const cloudRows =
    pane.kind === 'root' && !loading
      ? filterOptions<ChipSelectOption>(
          // Searchable as the vendors are; `ClaudeCloudItem` draws it.
          [
            {
              value: CLAUDE_CLOUD_ROW,
              label: t('sessions.new.where.claudeCloud.label'),
              description: claudeCloud?.label,
            },
            ...clouds,
          ],
          term,
        )
      : [];
  const rows: ChipSelectOption[] =
    pane.kind === 'host'
      ? filterOptions<ChipSelectOption>(
          SESSION_PLACES.map((candidate) => ({
            value: candidate,
            label: t(`sessions.new.where.${candidate}.label`),
            description: t(`sessions.new.where.${candidate}.description`),
            leading: <PlaceIcon place={candidate} />,
          })),
          term,
        )
      : pane.kind === 'start-from'
        ? filterOptions(startFrom, term)
        : tab === 'hosts'
          ? hostRows
          : cloudRows;

  function show(next: { pane?: Pane; query?: string }) {
    if (next.pane) setPane(next.pane);
    setQuery(next.query ?? '');
    setActive(0);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setTab(atVendor || place === 'cloud' ? 'cloud' : 'hosts');
    else show({ pane: ROOT });
  }

  function pickTab(next: Tab) {
    setTab(next);
    setActive(0);
  }

  /** A place on a host: from its pane, or Claude Code's cloud from Start from. */
  function pickPlace(target: string, next: SessionPlace) {
    if (target !== hostId) onHostChange(target);
    // Also from a vendor: a host's place takes the session back to the host.
    if (next !== place || atVendor) onPlaceChange(next);
    onOpenChange(false);
  }

  function choose(row: ChipSelectOption) {
    switch (pane.kind) {
      case 'host': {
        const next = SESSION_PLACES.find((candidate) => candidate === row.value);
        if (next) pickPlace(pane.host.value, next);
        return;
      }
      case 'start-from': {
        const from = startFrom.find((candidate) => candidate.value === row.value);
        if (from && !from.disabled) pickPlace(from.value, 'cloud');
        return;
      }
      case 'root':
        chooseAtRoot(row);
    }
  }

  function chooseAtRoot(row: ChipSelectOption) {
    if (row.value === CLAUDE_CLOUD_ROW) {
      if (claudeCloud) show({ pane: { kind: 'start-from' } });
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
    if (picked) show({ pane: { kind: 'host', host: picked } });
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
    const pointer = { highlighted: index === active, onMouseEnter: () => setActive(index) };
    switch (pane.kind) {
      case 'host':
        return (
          <ChipSelectItem
            key={option.value}
            selected={!atVendor && pane.host.value === hostId && option.value === place}
            {...pointer}
            aria-label={option.label}
            leading={option.leading}
            description={option.description}
            onClick={() => choose(option)}
          >
            {option.label}
          </ChipSelectItem>
        );
      case 'start-from': {
        const from = startFrom.find((candidate) => candidate.value === option.value);
        return from ? (
          <StartFromItem
            key={from.value}
            host={from}
            selected={!atVendor && place === 'cloud' && from.value === hostId}
            {...pointer}
            onClick={() => choose(from)}
          />
        ) : null;
      }
      case 'root':
        return rootRow(option, pointer);
    }
  }

  function rootRow(
    option: ChipSelectOption,
    pointer: { highlighted: boolean; onMouseEnter: () => void },
  ) {
    if (option.value === CLAUDE_CLOUD_ROW) {
      return (
        <ClaudeCloudItem
          key={option.value}
          host={claudeCloud}
          selected={!atVendor && place === 'cloud'}
          {...pointer}
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
        {...pointer}
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
        onClick={() => choose(option)}
      >
        {option.label}
      </ChipSelectItem>
    );
  }

  /** The way back to the root, naming the pane, and the pane's heading. */
  function paneHead() {
    switch (pane.kind) {
      case 'host':
        return (
          <>
            <ChipSelectBack onClick={() => show({ pane: ROOT })}>
              <span className="flex items-center gap-2">
                <span className={dotVariants({ state: pane.host.online ? 'running' : 'idle' })} />
                {pane.host.label}
                {pane.host.description ? (
                  <span className="truncate text-fg-muted">{pane.host.description}</span>
                ) : null}
              </span>
            </ChipSelectBack>
            <ChipSelectHeading>{t('sessions.new.where.startIn')}</ChipSelectHeading>
          </>
        );
      case 'start-from':
        return (
          <>
            <ChipSelectBack onClick={() => show({ pane: ROOT })}>
              <span className="flex items-center gap-2">
                <AgentMark agent="claude-code" />
                {t('sessions.new.where.claudeCloud.label')}
              </span>
            </ChipSelectBack>
            <ChipSelectHeading>{t('sessions.new.where.claudeCloud.startFrom')}</ChipSelectHeading>
          </>
        );
      case 'root':
        return (
          <ChipSelectTabs aria-label={t('sessions.new.where.label')}>
            <ChipSelectTab
              selected={tab === 'hosts'}
              count={loading ? undefined : hostRows.length}
              onClick={() => pickTab('hosts')}
            >
              {t('sessions.new.where.hosts')}
            </ChipSelectTab>
            <ChipSelectTab
              selected={tab === 'cloud'}
              count={loading ? undefined : cloudRows.length}
              onClick={() => pickTab('cloud')}
            >
              {t('sessions.new.where.clouds')}
            </ChipSelectTab>
          </ChipSelectTabs>
        );
    }
  }

  const searchLabel = t(
    pane.kind === 'root' && tab === 'cloud'
      ? 'sessions.new.where.searchClouds'
      : 'sessions.new.host.search',
  );

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
          placeholder={searchLabel}
          aria-label={searchLabel}
          onChange={(event) => show({ query: event.target.value })}
          onKeyDown={onKeyDown}
        />
        {paneHead()}
        <ChipSelectList
          role="listbox"
          aria-label={t(
            pane.kind === 'host' ? 'sessions.new.where.label' : 'sessions.new.host.label',
          )}
          loading={pane.kind === 'root' && loading}
          loadingText={t('sessions.new.host.loading')}
          empty={rows.length === 0}
          emptyText={
            pane.kind === 'root' && tab === 'cloud'
              ? t('sessions.new.where.cloudsEmpty')
              : (failure ?? t('sessions.new.host.empty'))
          }
        >
          {rows.map(row)}
        </ChipSelectList>
        <ChipSelectActionRow
          action={{ label: t('sessions.new.host.add'), onSelect: onAddHost }}
          onClose={() => onOpenChange(false)}
        />
      </ChipSelectPopup>
    </Popover>
  );
}
