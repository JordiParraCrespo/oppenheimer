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
import type { CodingAgentId, HostCloudAgentId } from '@oppenheimer/shared/agents';
import type { CloudAgentProviderId } from '@oppenheimer/shared/schemas/cloud-agent';
import { SESSION_PLACES, type SessionPlace } from '@oppenheimer/shared/schemas/session';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  filterOptions,
  type HostCloudRow,
  hostCloudKey,
  type PlaceCloud,
  type PlaceHost,
  placeLabelKey,
} from '../lib/session-options';
import { HostCloudItem } from './host-cloud-item';
import { PlaceIcon } from './place-icon';
import { StartFromItem } from './start-from-item';

/** A host-cloud row's value: no host id or vendor id is spelled this way. */
function hostCloudRowValue(agent: HostCloudAgentId): string {
  return `${agent}-cloud`;
}

/**
 * What the list shows: the hosts and the clouds, a host's places, or the
 * hosts an agent's cloud starts from. Each kind has its rows, its pick, its
 * row and its heading, chosen once by `pane.kind`.
 */
type Pane =
  | { kind: 'root' }
  | { kind: 'host'; host: PlaceHost }
  | { kind: 'start-from'; cloud: HostCloudRow };

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
 * (`product/versions/mvp/24-session-places.md` §3). Claude Code's cloud and
 * Codex's are a place on a host: that host starts the task in the cloud with
 * its own `claude` or `codex` (`product/research/cloud-agents.md` §5B). The
 * place is offered twice: in each host's pane, where it takes the engine
 * picked (`engineForPlace`), and as a row per agent first under Cloud
 * (`hostClouds`), which names the host the section above chose for it and
 * opens a Start from pane of every host as the section above judged it, the
 * ones that cannot start it disabled with the reason; with no host to start
 * from it is greyed out (§7). A connected vendor is picked outright,
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
  cloudAgent,
  hostClouds,
  clouds,
  cloud,
  onHostChange,
  onPlaceChange,
  onHostCloudChange,
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
  /** The draft's engine while the place is a cloud, which says whose cloud it is; null elsewhere. */
  cloudAgent: CodingAgentId | null;
  /** A row per cloud a host starts, each with its host and its Start from pane. */
  hostClouds: HostCloudRow[];
  /** The vendors a cloud session can run on; none when this server keeps no keys. */
  clouds: PlaceCloud[];
  /** The vendor picked to launch the session at, with no host; null for a host's place. */
  cloud: CloudAgentProviderId | null;
  onHostChange: (hostId: string) => void;
  onPlaceChange: (place: SessionPlace) => void;
  /** A host-cloud row's Start from pick: that agent's cloud, started from that host. */
  onHostCloudChange: (hostId: string, agent: HostCloudAgentId) => void;
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
  // holds. The vendors do not wait for the hosts; the host-cloud rows do,
  // since a loading host list has no host to start a cloud from yet.
  const hostRows = pane.kind === 'root' ? filterOptions<PlaceHost>(hosts, term) : [];
  const cloudRows =
    pane.kind === 'root'
      ? filterOptions<ChipSelectOption>(
          // Searchable as the vendors are; `HostCloudItem` draws them.
          [
            ...(loading
              ? []
              : hostClouds.map((row) => ({
                  value: hostCloudRowValue(row.agent),
                  label: t(`sessions.new.where.${hostCloudKey(row.agent)}.label`),
                  description: row.host?.label,
                }))),
            ...clouds,
          ],
          term,
        )
      : [];

  // The open list and what is said around its rows, decided once: the root's
  // tab or a pane. Only the hosts wait on a read; the panes list what is here.
  const hostsList = {
    search: t('sessions.new.host.search'),
    empty: failure ?? t('sessions.new.host.empty'),
    loading: false,
  };
  const list: { rows: ChipSelectOption[]; search: string; empty: string; loading: boolean } =
    pane.kind === 'host'
      ? {
          ...hostsList,
          rows: filterOptions<ChipSelectOption>(
            SESSION_PLACES.map((candidate) => ({
              value: candidate,
              label: t(`sessions.new.where.${candidate}.label`),
              description: t(`sessions.new.where.${candidate}.description`),
              leading: <PlaceIcon place={candidate} />,
            })),
            term,
          ),
        }
      : pane.kind === 'start-from'
        ? { ...hostsList, rows: filterOptions(pane.cloud.startFrom, term) }
        : tab === 'hosts'
          ? { ...hostsList, rows: hostRows, loading: Boolean(loading) }
          : {
              rows: cloudRows,
              search: t('sessions.new.where.searchClouds'),
              empty: t('sessions.new.where.cloudsEmpty'),
              loading: false,
            };
  const rows = list.rows;

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

  /** A place on a host, from its pane. */
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
        const from = pane.cloud.startFrom.find((candidate) => candidate.value === row.value);
        if (from && !from.disabled) {
          onHostCloudChange(from.value, pane.cloud.agent);
          onOpenChange(false);
        }
        return;
      }
      case 'root':
        chooseAtRoot(row);
    }
  }

  function chooseAtRoot(row: ChipSelectOption) {
    const hostCloud = hostClouds.find(
      (candidate) => hostCloudRowValue(candidate.agent) === row.value,
    );
    if (hostCloud) {
      if (hostCloud.host) show({ pane: { kind: 'start-from', cloud: hostCloud } });
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
        const from = pane.cloud.startFrom.find((candidate) => candidate.value === option.value);
        return from ? (
          <StartFromItem
            key={from.value}
            host={from}
            selected={
              !atVendor &&
              place === 'cloud' &&
              cloudAgent === pane.cloud.agent &&
              from.value === hostId
            }
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
    const hostCloud = hostClouds.find(
      (candidate) => hostCloudRowValue(candidate.agent) === option.value,
    );
    if (hostCloud) {
      return (
        <HostCloudItem
          key={option.value}
          agent={hostCloud.agent}
          host={hostCloud.host}
          selected={!atVendor && place === 'cloud' && cloudAgent === hostCloud.agent}
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
              {chosen && !vendor ? t(placeLabelKey(place, cloudAgent)) : option.description}
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
                <AgentMark agent={pane.cloud.agent} />
                {t(`sessions.new.where.${hostCloudKey(pane.cloud.agent)}.label`)}
              </span>
            </ChipSelectBack>
            <ChipSelectHeading>
              {t(`sessions.new.where.${hostCloudKey(pane.cloud.agent)}.startFrom`)}
            </ChipSelectHeading>
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
              : `${host?.label ?? t('sessions.new.host.placeholder')} · ${t(placeLabelKey(place, cloudAgent))}`}
          </ChipSelectTrigger>
        }
      />
      <ChipSelectPopup width={320} maxHeight={420}>
        <ChipSelectSearch
          value={query}
          placeholder={list.search}
          aria-label={list.search}
          onChange={(event) => show({ query: event.target.value })}
          onKeyDown={onKeyDown}
        />
        {paneHead()}
        <ChipSelectList
          role="listbox"
          aria-label={t(
            pane.kind === 'host' ? 'sessions.new.where.label' : 'sessions.new.host.label',
          )}
          loading={list.loading}
          loadingText={t('sessions.new.host.loading')}
          empty={rows.length === 0}
          emptyText={list.empty}
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
