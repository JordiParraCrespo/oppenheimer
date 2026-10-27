import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { Cloud } from '@oppenheimer/design-system-web/icons';
import { useSuspenseCloudAgentStatus } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LaunchCloudAgent } from './launch-cloud-agent';

/**
 * What `/cloud` offers: the launch form on the first connected vendor, or,
 * with none connected, where to connect one (Settings → Cloud agents).
 */
export function CloudAgentsLandingPanel() {
  const { t } = useTranslation();
  const { data: status, error } = useSuspenseCloudAgentStatus();
  const provider = status.providers.find((row) => row.connected);

  return (
    <>
      <ErrorAlert error={error} fallback={t('sessions.cloudAgents.landing.statusFailed')} />
      {provider ? (
        <LaunchCloudAgent provider={provider.id} label={provider.label} />
      ) : (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Cloud />
            </EmptyState.Media>
            <EmptyState.Title>{t('sessions.cloudAgents.landing.connectTitle')}</EmptyState.Title>
            <EmptyState.Description>
              {t('sessions.cloudAgents.landing.connectDescription')}
            </EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <Button render={<Link to="/settings/cloud-agents" />}>
              {t('sessions.cloudAgents.landing.connectAction')}
            </Button>
          </EmptyState.Content>
        </EmptyState>
      )}
    </>
  );
}
