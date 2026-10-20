import { Alert, AlertDescription, SettingsTitle } from '@oppenheimer/design-system-web';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ModelProvidersSkeleton } from '../components/model-providers-skeleton';
import { ModelProviders } from '../sections/model-providers';

/**
 * Settings → Model providers (`product/versions/mvp/25-bots.md` §2): one row
 * per provider a bot can run on, with whether the workspace has a key for it.
 * A server with no sealing key says so above the list, whose edits are off.
 */
export function ModelProvidersSettingsScreen() {
  const { t } = useTranslation();
  const { data: deployment } = useDeploymentCapabilities();
  return (
    <>
      <SettingsTitle
        title={t('settings.modelProviders.title')}
        description={t('settings.modelProviders.description')}
      />
      {deployment && !deployment.bot_providers ? (
        <Alert className="mb-4">
          <AlertDescription>{t('settings.modelProviders.unavailable')}</AlertDescription>
        </Alert>
      ) : null}
      <QueryState>
        <QueryState.Pending>
          <ModelProvidersSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.modelProviders.loadFailed')} />
        <QueryState.Data>
          <ModelProviders />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
