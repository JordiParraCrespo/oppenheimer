import { PageHeaderRow } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { LaunchCloudAgentSkeleton } from '../components/launch-cloud-agent-skeleton';
import { CloudAgentsLandingPanel } from '../sections/cloud-agents-landing-panel';

/**
 * `/cloud`: launch a cloud agent (`product/next-steps/cloud-agents.md`). The
 * panel under the title asks whether a vendor is connected and draws the
 * launch form, or the way to connect one.
 */
export function CloudAgentsLandingScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderRow title={t('sessions.cloudAgents.landing.title')} />
      <QueryState>
        <QueryState.Pending>
          <LaunchCloudAgentSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('sessions.cloudAgents.landing.statusFailed')} />
        <QueryState.Data>
          <CloudAgentsLandingPanel />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
