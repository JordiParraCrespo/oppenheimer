import { QueryState } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionsSidebarSkeleton } from '../components/sessions-sidebar-skeleton';
import { useFoldedSessions } from '../hooks/use-folded-sessions';
import { NewSessionButton } from './new-session-button';
import { SessionsSidebarBody } from './sessions-sidebar-body';

/**
 * The console's sidebar body: New session, which needs no read and stays in
 * every state, the section's bots (`bots`, the route's to compose, since they
 * are another feature's), and the sessions under it, read under Suspense.
 */
export function SessionsSidebar({ bots }: { bots?: ReactNode }) {
  const { t } = useTranslation();
  const list = useFoldedSessions();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2.5">
        <NewSessionButton />
      </div>
      {bots}
      <QueryState>
        <QueryState.Pending>
          <SessionsSidebarSkeleton open={list.open} />
        </QueryState.Pending>
        <QueryState.Error fallback={t('sessions.sidebar.loadFailed')} className="mx-3 mt-2" />
        <QueryState.Data>
          <SessionsSidebarBody />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
