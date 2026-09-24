import {
  Button,
  EmptyState,
  SessionItem,
  SessionList,
  Skeleton,
} from '@oppenheimer/design-system-web';
import type { SessionEntity, SessionGroup } from '@oppenheimer/frontend-consumer';
import { useHosts, usePrefetchSession, useSessions } from '@oppenheimer/frontend-consumer/react';
import { compactAge } from '@oppenheimer/frontend-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionFilterChips } from '../components/session-filter-chips';
import { SessionsFilterMenu } from '../components/sessions-filter-menu';
import {
  ALL,
  activeFilters,
  agentOptions,
  applyFilters,
  DEFAULT_FILTERS,
  hostOptions,
  isFiltered,
  repositoryOptions,
  type SessionFilters,
} from '../lib/session-filters';

/**
 * How a session's **group** reads as a dot.
 *
 * The group is what the sidebar shows because it is organised by what needs
 * you rather than by what a process is doing
 * (`product/versions/mvp/05-screens.md`): a session that failed, one whose
 * agent has been blocked for thirty seconds and one whose launch has sat
 * unready for a minute all want the same glance. `working` is the pulsing dot
 * of a session with something happening on a machine elsewhere.
 *
 * One dot is not the group's to give: a session the host has not built yet
 * reads as `idle`, because nothing needs you about it — but the artboard draws
 * it joining the list at once with a pulsing grey glyph, and that is the
 * **lifecycle** speaking, not the group. {@link dotFor} puts the two together.
 */
const DOT: Record<SessionGroup, 'running' | 'idle' | 'failed' | 'pending' | 'completed'> = {
  working: 'running',
  'waiting-on-you': 'failed',
  'ready-for-review': 'running',
  landing: 'pending',
  idle: 'idle',
  resolved: 'completed',
};

/** The dot a row shows: provisioning first, then what needs you. */
function dotFor(session: SessionEntity) {
  return session.isProvisioning ? 'pending' : DOT[session.state];
}

/**
 * The console's sidebar body: New session, then the sessions themselves.
 *
 * This is the sidebar of the version-1 artboards — the product is the list, so
 * the list is the navigation, and there are no other destinations. It is a
 * feature rather than kit because it reads a product hook; the brand row above
 * it and the account menu below it are the shell's.
 *
 * The measurements are the export's, so this composes rather than styles: the
 * button block sits in 12px with 10px under it, the list head is
 * `.op-listhead` (2px/12px/6px, an 11px uppercase title against a mono count
 * and the filter button), the chips for whatever is being hidden sit under it,
 * and only the list scrolls, inside `.op-sidebar__scroll`'s 8px/12px/20px. The
 * rows themselves are the design system's `SessionList` and `SessionItem`,
 * which are already cut to this artboard.
 *
 * The filters live here rather than in the menu because this is what they
 * narrow, and in state rather than the URL because they are a view of the
 * navigation, not a destination: the console's URL is the session that is
 * open, and a filter must not change which one that is.
 */
export function SessionsSidebar() {
  const { t } = useTranslation();
  const { data: sessions, isPending } = useSessions();
  // Named by the host list, because a session carries only the host's id and
  // an id is not a filter anyone can read.
  const { data: hosts } = useHosts();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [filters, setFilters] = useState<SessionFilters>(DEFAULT_FILTERS);

  const all = sessions ?? [];
  const options = {
    repository: repositoryOptions(all, t('sessions.filters.allRepositories')),
    agent: agentOptions(all, t('sessions.filters.allAgents'), (agent) =>
      t(`sessions.agents.${agent}` as 'sessions.agents.claude-code'),
    ),
    host: hostOptions(all, hosts, t('sessions.filters.allHosts')),
  };
  const visible = applyFilters(all, filters);
  const dirty = isFiltered(filters);
  const chips = activeFilters(filters, options);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2.5">
        <Button size="sm" block render={<Link to="/sessions/new" />}>
          {t('nav.newSession')}
        </Button>
      </div>

      <div className="flex items-center gap-2 px-3 pt-0.5 pb-1.5">
        <span className="min-w-0 flex-1 text-[11px] tracking-[0.04em] text-fg-muted uppercase">
          {t('nav.sessions')}
        </span>
        {/* No count until the list has settled: a zero under a request that
            has not answered reads as "you have none", which is a different
            thing from "not yet known". The count is what is on screen, so a
            filtered list counts what it shows. */}
        {sessions ? (
          <span className="figures text-[11px] text-fg-muted">{visible.length}</span>
        ) : null}
        {sessions ? (
          <SessionsFilterMenu
            filters={filters}
            options={options}
            dirty={dirty}
            onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onClear={() => setFilters((current) => ({ ...DEFAULT_FILTERS, sort: current.sort }))}
          />
        ) : null}
      </div>

      {dirty ? (
        <SessionFilterChips
          chips={chips}
          onClear={(key) => setFilters((current) => ({ ...current, [key]: ALL }))}
        />
      ) : null}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-5">
        {isPending ? (
          <SessionList>
            <Skeleton className="h-[30px] w-full rounded-sm" />
            <Skeleton className="h-[30px] w-full rounded-sm" />
            <Skeleton className="h-[30px] w-full rounded-sm" />
          </SessionList>
        ) : (
          // Nothing when there are none: the empty case is the pane's to
          // explain, and a sidebar that argues with it says it twice. A list
          // emptied by a filter is the one case the pane cannot explain, so
          // that one says so here, in `.op-emptylist`.
          <SessionList>
            {visible.map((session) => (
              <SessionRow key={session.id} session={session} pathname={pathname} />
            ))}
            {dirty && visible.length === 0 ? (
              <EmptyState compact>
                <EmptyState.Description>{t('sessions.filters.noMatches')}</EmptyState.Description>
              </EmptyState>
            ) : null}
          </SessionList>
        )}
      </div>
    </div>
  );
}

/**
 * One row. The age is derived on render rather than held: `compactAge` returns
 * the unit and the count, and the words are ours to translate — `null` is
 * "less than a minute", which the artboard leaves blank rather than labelling.
 *
 * Pointing at a row or tabbing to it reads the session ahead of the click, the
 * way the `Link` already fetches the route's code, so the pane opens on data
 * the cache holds rather than on a skeleton.
 */
function SessionRow({ session, pathname }: { session: SessionEntity; pathname: string }) {
  const { t } = useTranslation();
  const prefetch = usePrefetchSession();
  const age = compactAge(session.createdAt);
  const onIntent = () => prefetch(session.id);

  return (
    <SessionItem
      name={session.name}
      age={age ? t(`common.relative.${age.unit}`, { count: age.count }) : undefined}
      state={dotFor(session)}
      active={pathname === `/sessions/${session.id}`}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      render={<Link to="/sessions/$sessionId" params={{ sessionId: session.id }} />}
    />
  );
}
