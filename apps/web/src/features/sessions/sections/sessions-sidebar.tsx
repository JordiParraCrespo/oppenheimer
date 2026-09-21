import { Button, SessionItem, SessionList, Skeleton } from '@oppenheimer/design-system-web';
import type { SessionEntity, SessionGroup } from '@oppenheimer/frontend-consumer';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { compactAge } from '@oppenheimer/frontend-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * How a session's **group** reads as a dot.
 *
 * The group is what the sidebar shows because it is organised by what needs
 * you rather than by what a process is doing
 * (`product/versions/mvp/05-screens.md`): a session that failed, one whose
 * agent has been blocked for thirty seconds and one whose launch has sat
 * unready for a minute all want the same glance. `working` is the pulsing dot
 * of a session with something happening on a machine elsewhere.
 */
const DOT: Record<SessionGroup, 'running' | 'idle' | 'failed' | 'pending' | 'completed'> = {
  working: 'running',
  'waiting-on-you': 'failed',
  'ready-for-review': 'running',
  landing: 'pending',
  idle: 'idle',
  resolved: 'completed',
};

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
 * `.op-listhead` (2px/12px/6px, an 11px uppercase title against a mono count),
 * and only the list scrolls, inside `.op-sidebar__scroll`'s 8px/12px/20px. The
 * rows themselves are the design system's `SessionList` and `SessionItem`,
 * which are already cut to this artboard.
 *
 * The filter menu the artboard puts beside the count (repository, agent, host,
 * sort) is not here yet: the count is, because it is the list's own length.
 */
export function SessionsSidebar() {
  const { t } = useTranslation();
  const { data: sessions, isPending } = useSessions();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

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
            thing from "not yet known". */}
        {sessions ? (
          <span className="figures text-[11px] text-fg-muted">{sessions.length}</span>
        ) : null}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-5">
        {isPending ? (
          <SessionList>
            <Skeleton className="h-[30px] w-full rounded-sm" />
            <Skeleton className="h-[30px] w-full rounded-sm" />
            <Skeleton className="h-[30px] w-full rounded-sm" />
          </SessionList>
        ) : (
          // Nothing when there are none: the empty case is the pane's to
          // explain, and a sidebar that argues with it says it twice.
          <SessionList>
            {sessions?.map((session) => (
              <SessionRow key={session.id} session={session} pathname={pathname} />
            ))}
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
 */
function SessionRow({ session, pathname }: { session: SessionEntity; pathname: string }) {
  const { t } = useTranslation();
  const age = compactAge(session.createdAt);

  return (
    <SessionItem
      name={session.name}
      age={age ? t(`common.relative.${age.unit}`, { count: age.count }) : undefined}
      state={DOT[session.state]}
      active={pathname === `/sessions/${session.id}`}
      render={<Link to="/sessions/$sessionId" params={{ sessionId: session.id }} />}
    />
  );
}
