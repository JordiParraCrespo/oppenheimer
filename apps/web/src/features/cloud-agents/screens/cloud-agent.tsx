import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { CloudAgentDetailSkeleton } from '../components/cloud-agent-detail-skeleton';
import { CloudAgentDetail } from '../sections/cloud-agent-detail';

/** `/cloud/$agentId`: one cloud agent, followed while it works. */
export function CloudAgentScreen({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  return (
    <QueryState>
      <QueryState.Pending>
        <CloudAgentDetailSkeleton />
      </QueryState.Pending>
      <QueryState.Error fallback={t('sessions.cloudAgents.detail.loadFailed')} />
      <QueryState.Data>
        <CloudAgentDetail agentId={agentId} />
      </QueryState.Data>
    </QueryState>
  );
}
