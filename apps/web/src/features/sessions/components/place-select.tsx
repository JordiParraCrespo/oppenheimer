import {
  ChipSelectActionRow,
  ChipSelectBack,
  ChipSelectHeading,
  ChipSelectItem,
  ChipSelectList,
  ChipSelectPopup,
  ChipSelectSearch,
  ChipSelectTabs,
  ChipSelectTrigger,
  dotVariants,
  Popover,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { ChevronRight, Folder, GitBranch } from '@oppenheimer/design-system-web/icons';
import { SESSION_PLACES, type SessionPlace } from '@oppenheimer/shared/schemas/session';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlaceHost } from '../lib/session-options';

/** The pane's one tab: the frame's environments and cloud are not built (05). */
const HOSTS_TAB = 'hosts';

/**
 * The first chip of New session: the host and where on it the session runs,
 * read as one ("mac-studio · New worktree"), as `NewSessionComposer.dc.html`
 * draws it. The pane lists the hosts under their tab, each with its presence
 * dot and summary; a host opens its Start in pane, and picking a place there
 * picks the host with it (`product/versions/mvp/24-session-places.md` §3).
 * Add host… is the foot. Props in, choices out: the section above fetches.
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

  const host = hosts.find((candidate) => candidate.value === hostId) ?? null;
  const term = query.trim().toLowerCase();
  const shownHosts = hosts.filter((candidate) =>
    `${candidate.label} ${candidate.description ?? ''} ${candidate.keywords ?? ''}`
      .toLowerCase()
      .includes(term),
  );
  const shownPlaces = SESSION_PLACES.filter((candidate) =>
    t(`sessions.new.where.${candidate}.label`).toLowerCase().includes(term),
  );

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setPane(null);
      setQuery('');
    }
  }

  function pick(next: SessionPlace) {
    if (pane && pane.value !== hostId) onHostChange(pane.value);
    if (next !== place) onPlaceChange(next);
    onOpenChange(false);
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
          onChange={(event) => setQuery(event.target.value)}
        />
        {pane ? (
          <>
            <ChipSelectBack
              onClick={() => {
                setPane(null);
                setQuery('');
              }}
            >
              <span className="flex items-center gap-2">
                <span className={dotVariants({ state: pane.online ? 'running' : 'idle' })} />
                {pane.label}
                {pane.description ? (
                  <span className="truncate text-fg-muted">{pane.description}</span>
                ) : null}
              </span>
            </ChipSelectBack>
            <ChipSelectHeading>{t('sessions.new.where.startIn')}</ChipSelectHeading>
            <ChipSelectList role="listbox" aria-label={t('sessions.new.where.label')}>
              {shownPlaces.map((candidate) => (
                <ChipSelectItem
                  key={candidate}
                  selected={pane.value === hostId && candidate === place}
                  leading={candidate === 'folder' ? <Folder /> : <GitBranch />}
                  description={t(`sessions.new.where.${candidate}.description`)}
                  onClick={() => pick(candidate)}
                >
                  {t(`sessions.new.where.${candidate}.label`)}
                </ChipSelectItem>
              ))}
            </ChipSelectList>
          </>
        ) : (
          <>
            <ChipSelectTabs
              aria-label={t('sessions.new.where.label')}
              tabs={[
                {
                  id: HOSTS_TAB,
                  label: t('sessions.new.where.hosts'),
                  count: loading ? undefined : hosts.length,
                },
              ]}
              value={HOSTS_TAB}
              onValueChange={() => {}}
            />
            <ChipSelectList
              role="listbox"
              aria-label={t('sessions.new.host.label')}
              loading={loading}
              loadingText={t('sessions.new.host.loading')}
              empty={shownHosts.length === 0}
              emptyText={failure ?? t('sessions.new.host.empty')}
            >
              {shownHosts.map((candidate) => (
                <ChipSelectItem
                  key={candidate.value}
                  selected={candidate.value === hostId}
                  aria-label={candidate.label}
                  leading={
                    <span
                      className={dotVariants({ state: candidate.online ? 'running' : 'idle' })}
                    />
                  }
                  trailing={
                    <span className="flex min-w-0 shrink items-center gap-1.5 text-xs text-fg-muted">
                      <span className="truncate">
                        {candidate.value === hostId
                          ? t(`sessions.new.where.${place}.label`)
                          : candidate.description}
                      </span>
                      <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" />
                    </span>
                  }
                  onClick={() => {
                    setPane(candidate);
                    setQuery('');
                  }}
                >
                  {candidate.label}
                </ChipSelectItem>
              ))}
            </ChipSelectList>
          </>
        )}
        <ChipSelectActionRow
          action={{ label: t('sessions.new.host.add'), onSelect: onAddHost }}
          onClose={() => onOpenChange(false)}
        />
      </ChipSelectPopup>
    </Popover>
  );
}
