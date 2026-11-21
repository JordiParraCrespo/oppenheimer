import { Callout, SettingsTitle } from '@oppenheimer/design-system-web';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ModelProvidersSkeleton } from '../components/model-providers-skeleton';
import { VoiceSettingsSkeleton } from '../components/voice-settings-skeleton';
import { ModelProviders } from '../sections/model-providers';
import { VoiceSettingsSection } from '../sections/voice-settings';

/**
 * Settings → Model providers: one row per provider, bots' and voice-only,
 * with whether the workspace has a key for it, then Voice: which of them
 * hears dictation, speaks voice notes and tidies a transcript. A server with
 * no sealing key says so above the list, whose edits are off. The two read
 * apart, each under its own `QueryState`, so one failing leaves the other.
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
          <ModelProvidersSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.modelProviders.loadFailed')} />
        <QueryState.Data>
          <ModelProviders />
        </QueryState.Data>
      </QueryState>
      <QueryState>
        <QueryState.Pending>
          <VoiceSettingsSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.modelProviders.voice.loadFailed')} />
        <QueryState.Data>
          <VoiceSettingsSection />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
