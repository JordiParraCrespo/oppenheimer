import { SessionList, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NewSessionButton } from './new-session-button';
import { SessionsSidebarBody } from './sessions-sidebar-body';

/**
 * The console's sidebar body: New session, which needs no read and stays in
 * every state, the section's bots (`bots`, the route's to compose, since they
 * are another feature's), and the sessions under it, read under Suspense.
 */
export function SessionsSidebar({ bots }: { bots?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2.5">
        <NewSessionButton />
      </div>
      {bots}
      <QueryState>
        <QueryState.Pending>
          <SessionList className="mx-3 mt-2">
            <Skeleton shape="sm" className="h-7.5 w-full" />
            <Skeleton shape="sm" className="h-7.5 w-full" />
            <Skeleton shape="sm" className="h-7.5 w-full" />
          </SessionList>
        </QueryState.Pending>
        <QueryState.Error fallback={t('sessions.sidebar.loadFailed')} className="mx-3 mt-2" />
        <QueryState.Data>
          <SessionsSidebarBody />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
