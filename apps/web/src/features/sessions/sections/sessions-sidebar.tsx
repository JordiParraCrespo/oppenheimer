import { Button, SessionItem, Skeleton } from '@oppenheimer/design-system-web';
import type { SessionEntity, SessionState } from '@oppenheimer/frontend-consumer';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { compactAge } from '@oppenheimer/frontend-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * How a session's own state reads as a dot. `starting` is the pulsing grey of
 * a session that has joined the list before its worktree exists
 * (`product/versions/mvp/05-screens.md`); the rest map straight across.
 */
const DOT: Record<SessionState, 'running' | 'idle' | 'failed' | 'pending' | 'completed'> = {
  starting: 'pending',
  running: 'running',
  idle: 'idle',
  stopped: 'completed',
  failed: 'failed',
};

/**
 * The console's sidebar body: New session, then the sessions themselves.
 *
 * This is the sidebar of the version-1 artboards — the product is the list, so
 * the list is the navigation, and there are no other destinations. It is a
 * feature rather than kit because it reads a product hook; the brand row above
 * it and the account menu below it are the shell's.
 *
 * The filter menu the artboard puts beside the count (repository, agent, host,
 * sort) is not here yet: the count is, because it is the list's own length.
 */
export function SessionsSidebar() {
  const { t } = useTranslation();
  const { data: sessions, isPending } = useSessions();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex min-h-0 flex-col gap-3 px-3">
      <Button size="lg" block render={<Link to="/sessions/new" />}>
        {t('nav.newSession')}
      </Button>

      <div className="flex items-center justify-between gap-2 px-2">
        <span className="text-[11px] tracking-[0.04em] text-fg-subtle uppercase">
          {t('nav.sessions')}
        </span>
        {/* No count until the list has settled: a zero under a request that
            has not answered reads as "you have none", which is a different
            thing from "not yet known". */}
        {sessions ? (
          <span className="figures text-xs text-fg-subtle">{sessions.length}</span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-col gap-px overflow-y-auto">
        {isPending ? (
          <>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </>
        ) : (
          sessions?.map((session) => (
            <SessionRow key={session.id} session={session} pathname={pathname} />
          ))
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
