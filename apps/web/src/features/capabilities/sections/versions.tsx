import {
  SettingsGroup,
  SettingsHeading,
  SettingsRow,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useApiVersion } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';

/**
 * Versions: the console's own, baked in at build from its `package.json`, and
 * the API's, read from `GET /health/version`. Side by side so a reader can
 * tell when a deploy updated one and not the other.
 */
export function VersionsSection() {
  const { t } = useTranslation();
  const api = useApiVersion();

  return (
    <section className="flex flex-col gap-3">
      <SettingsHeading>{t('settings.about.versionsHeading')}</SettingsHeading>
      <SettingsGroup>
        <SettingsRow label={t('settings.about.console')} hint={t('settings.about.consoleHint')}>
          <span className="font-mono text-fg-muted">{__APP_VERSION__}</span>
        </SettingsRow>
        <SettingsRow label={t('settings.about.api')} hint={t('settings.about.apiHint')}>
          {api.data ? (
            <span className="font-mono text-fg-muted">{api.data.version}</span>
          ) : api.isError ? (
            <span className="text-fg-muted">{t('settings.about.unavailable')}</span>
          ) : (
            <Skeleton className="h-4 w-12" />
          )}
        </SettingsRow>
      </SettingsGroup>
    </section>
  );
}
