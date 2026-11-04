import { SettingsGroup, SettingsRow } from '@oppenheimer/design-system-web';
import { useSuspenseApiVersion } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The versions, in `VersionsSection`'s `QueryState.Data`: the console's own,
 * built in from its `package.json`, and the API's. A refetch that fails keeps
 * the rows and says so above them.
 */
export function VersionRows() {
  const { t } = useTranslation();
  const { data, error } = useSuspenseApiVersion();

  return (
    <>
      <ErrorAlert error={error} fallback={t('settings.about.failed')} />
      <SettingsGroup>
        <SettingsRow label={t('settings.about.console')} hint={t('settings.about.consoleHint')}>
          <span className="font-mono text-fg-muted">{__APP_VERSION__}</span>
        </SettingsRow>
        <SettingsRow label={t('settings.about.api')} hint={t('settings.about.apiHint')}>
          <span className="font-mono text-fg-muted">{data.version}</span>
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
