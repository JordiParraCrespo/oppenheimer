import { Callout, PillTab, PillTabs, SettingsTitle } from '@oppenheimer/design-system-web';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ModelProvidersSkeleton } from '../components/model-providers-skeleton';
import { VoiceSettingsSkeleton } from '../components/voice-settings-skeleton';
import { useModelProvidersTab } from '../hooks/use-model-providers-tab';
import { MODEL_PROVIDER_TABS, type ModelProviderTab } from '../lib/model-providers-search';
import { ConnectedProvidersCount } from '../sections/connected-providers-count';
import { ModelProviders } from '../sections/model-providers';
import { VoiceSettingsSection } from '../sections/voice-settings';

/**
 * Settings → Model providers, in two tabs (`?tab=`): Providers, one row per
 * provider, bots' and voice-only, with whether the workspace has a key for
 * it; and Voice, which of them hears dictation, speaks voice notes and tidies
 * a transcript. A server with no sealing key says so above both, and the
 * key edits are off. Each tab reads under its own `QueryState`, keyed, so a
 * switch shows the other's placeholder rather than the last tab's failure.
 */
export function ModelProvidersSettingsScreen() {
  const { t } = useTranslation();
  const { data: deployment } = useDeploymentCapabilities();
  const { tab, setTab } = useModelProvidersTab();
  return (
    <>
      <SettingsTitle
        title={t('settings.modelProviders.title')}
        description={t('settings.modelProviders.description')}
      />
      {deployment && !deployment.bot_providers ? (
        <Callout className="mb-4">{t('settings.modelProviders.unavailable')}</Callout>
      ) : null}
      <PillTabs
        size="sm"
        className="mb-4"
        aria-label={t('settings.modelProviders.tabs.label')}
        value={tab}
        onValueChange={(next) => setTab(next as ModelProviderTab)}
      >
        {MODEL_PROVIDER_TABS.map((id) => (
          <PillTab
            key={id}
            value={id}
            count={id === 'providers' ? <ConnectedProvidersCount /> : undefined}
          >
            {t(`settings.modelProviders.tabs.${id}`)}
          </PillTab>
        ))}
      </PillTabs>
      {tab === 'providers' ? (
        <QueryState key="providers">
          <QueryState.Pending>
            <ModelProvidersSkeleton />
          </QueryState.Pending>
          <QueryState.Error fallback={t('settings.modelProviders.loadFailed')} />
          <QueryState.Data>
            <ModelProviders />
          </QueryState.Data>
        </QueryState>
      ) : (
        <QueryState key="voice">
          <QueryState.Pending>
            <VoiceSettingsSkeleton />
          </QueryState.Pending>
          <QueryState.Error fallback={t('settings.modelProviders.voice.loadFailed')} />
          <QueryState.Data>
            <VoiceSettingsSection />
          </QueryState.Data>
        </QueryState>
      )}
    </>
  );
}
