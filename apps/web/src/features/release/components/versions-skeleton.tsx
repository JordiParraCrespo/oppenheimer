import { SettingsGroup, SettingsRow, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The versions before the API answers: the same card and labels, the
 * console's own version already known, and a bar where the API's lands.
 */
export function VersionsSkeleton() {
  const { t } = useTranslation();
  return (
    <SettingsGroup aria-busy>
      <LoadingStatus />
      <SettingsRow label={t('settings.about.console')} hint={t('settings.about.consoleHint')}>
        <span className="font-mono text-fg-muted">{__APP_VERSION__}</span>
      </SettingsRow>
      <SettingsRow aria-hidden label={t('settings.about.api')} hint={t('settings.about.apiHint')}>
        <span className="flex h-5 items-center">
          <Skeleton shape="sm" className="h-3 w-10" />
        </span>
      </SettingsRow>
    </SettingsGroup>
  );
}
