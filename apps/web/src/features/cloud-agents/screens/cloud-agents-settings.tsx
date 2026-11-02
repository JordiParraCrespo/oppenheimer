import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { CloudAgentProvidersSkeleton } from '../components/cloud-agent-providers-skeleton';
import { CloudAgentProviders } from '../sections/cloud-agent-providers';

/**
 * Settings → Cloud agents (`product/next-steps/cloud-agents.md`): one row per
 * vendor a cloud agent can run on, connected with the reader's own key.
 */
export function CloudAgentsSettingsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle
        title={t('settings.cloudAgents.title')}
        description={t('settings.cloudAgents.description')}
      />
      <QueryState>
        <QueryState.Pending>
          <CloudAgentProvidersSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.cloudAgents.loadFailed')} />
        <QueryState.Data>
          <CloudAgentProviders />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
