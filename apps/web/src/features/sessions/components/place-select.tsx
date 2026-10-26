import {
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
import { ChevronRight, Folder, GitBranch } from '@oppenheimer/design-system-web/icons';
import { SESSION_PLACES, type SessionPlace } from '@oppenheimer/shared/schemas/session';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { filterOptions, type PlaceHost } from '../lib/session-options';

/**
 * The first chip of New session: the host and where on it the session runs,
 * read as one ("mac-studio · New worktree"), as `NewSessionComposer.dc.html`
 * draws it. The pane lists the hosts under a Hosts heading with their count
 * (the frame's environments and cloud are not built, 05), each with its
 * presence dot and summary; a host opens its Start in pane, and picking a
 * place there picks the host with it
 * (`product/versions/mvp/24-session-places.md` §3). Add host… is the foot.
 * Props in, choices out: the section above fetches.
 *
 * Both panes are one list under one search: the hosts, or the host's places.
 * The arrows move through it and Enter takes the row, as in `ChipSelect`.
 *
 * A list that has not arrived is `loading`, not `disabled`: a greyed chip
 * reads as one this workspace may not use.
 */
export function PlaceSelect({
  hosts,
  hostId,
  place,
  onHostChange,
  onPlaceChange,
  onAddHost,
  loading,
  failure,
  disabled,
}: {
  hosts: PlaceHost[];
  hostId: string | null;
  place: SessionPlace;
  onHostChange: (hostId: string) => void;
  onPlaceChange: (place: SessionPlace) => void;
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
  const places: ChipSelectOption[] = SESSION_PLACES.map((candidate) => ({
    value: candidate,
    label: t(`sessions.new.where.${candidate}.label`),
    description: t(`sessions.new.where.${candidate}.description`),
    leading: candidate === 'folder' ? <Folder /> : <GitBranch />,
  }));
  const rows = filterOptions<ChipSelectOption>(pane ? places : hosts, query.trim().toLowerCase());

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
      const picked = hosts.find((candidate) => candidate.value === row.value);
      if (picked) show({ pane: picked });
      return;
    }
    const next = SESSION_PLACES.find((candidate) => candidate === row.value);
    if (!next) return;
    if (pane.value !== hostId) onHostChange(pane.value);
    if (next !== place) onPlaceChange(next);
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

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <ChipSelectTrigger
            icon={place === 'folder' ? <Folder /> : <GitBranch />}
            open={open}
            disabled={disabled}
            variant="tab"
            aria-label={t('sessions.new.host.label')}
          >
            {`${host?.label ?? t('sessions.new.host.placeholder')} · ${t(`sessions.new.where.${place}.label`)}`}
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
          loading={!pane && loading}
          loadingText={t('sessions.new.host.loading')}
          empty={rows.length === 0}
          emptyText={failure ?? t('sessions.new.host.empty')}
        >
          {rows.map((row, index) => {
            const online = pane ? null : hosts.find((candidate) => candidate.value === row.value);
            return (
              <ChipSelectItem
                key={row.value}
                selected={
                  pane ? pane.value === hostId && row.value === place : row.value === hostId
                }
                highlighted={index === active}
                aria-label={row.label}
                leading={
                  online ? (
                    <span className={dotVariants({ state: online.online ? 'running' : 'idle' })} />
                  ) : (
                    row.leading
                  )
                }
                description={pane ? row.description : undefined}
                trailing={
                  pane ? undefined : (
                    <span className="flex min-w-0 shrink items-center gap-1.5 text-xs text-fg-muted">
                      <span className="truncate">
                        {row.value === hostId
                          ? t(`sessions.new.where.${place}.label`)
                          : row.description}
                      </span>
                      <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" />
                    </span>
                  )
                }
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(row)}
              >
                {row.label}
              </ChipSelectItem>
            );
          })}
        </ChipSelectList>
        <ChipSelectActionRow
          action={{ label: t('sessions.new.host.add'), onSelect: onAddHost }}
          onClose={() => onOpenChange(false)}
        />
      </ChipSelectPopup>
    </Popover>
  );
}
