import { Callout, SettingsTitle, Skeleton } from '@oppenheimer/design-system-web';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
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
        <Callout className="mb-4">{t('settings.modelProviders.unavailable')}</Callout>
      ) : null}
      <QueryState>
        <QueryState.Pending>
          <Skeleton className="h-40 w-full" />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.modelProviders.loadFailed')} />
        <QueryState.Data>
          <ModelProviders />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
