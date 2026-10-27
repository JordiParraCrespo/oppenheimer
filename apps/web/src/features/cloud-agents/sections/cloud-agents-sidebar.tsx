import { RoutineItem, SidebarListHead } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { QueryState } from '@oppenheimer/frontend-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CloudAgentsListSkeleton } from '../components/cloud-agents-list-skeleton';
import { CloudAgentsList } from './cloud-agents-list';

/**
 * The console's sidebar body on Cloud agents: New cloud agent, then the
 * reader's agents, newest first, each with where its run stands.
 */
export function CloudAgentsSidebar() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pb-5">
      <div className="flex flex-col gap-0.5 px-3 pt-3 pb-2">
        <RoutineItem
          name={t('sessions.cloudAgents.sidebar.new')}
          icon={<Plus />}
          active={Boolean(matchRoute({ to: '/cloud' }))}
          render={<Link to="/cloud" />}
        />
      </div>
      <SidebarListHead label={t('sessions.cloudAgents.sidebar.agents')} />
      <QueryState>
        <QueryState.Pending>
          <CloudAgentsListSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('sessions.cloudAgents.sidebar.listFailed')} />
        <QueryState.Data>
          <CloudAgentsList />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
