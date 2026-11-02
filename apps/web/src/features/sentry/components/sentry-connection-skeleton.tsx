import { SettingsGroup, SettingsListRow, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The Sentry row before the status answers: its name is known, so it is
 * written; which organization is connected and the row's button are bars on
 * the row's own frame.
 */
export function SentryConnectionSkeleton() {
  const { t } = useTranslation();
  return (
    <SettingsGroup aria-busy>
      <SettingsListRow
        align="center"
        aria-hidden
        kind={<Skeleton shape="sm" className="h-2 w-24" />}
        meta={t('settings.sentry.meta')}
        actions={<Skeleton shape="pill" className="h-7 w-18" />}
      >
        {t('settings.sentry.name')}
      </SettingsListRow>
      <LoadingStatus />
    </SettingsGroup>
  );
}
