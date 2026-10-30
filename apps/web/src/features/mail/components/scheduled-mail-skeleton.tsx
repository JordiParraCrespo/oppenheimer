import {
  SettingsGroup,
  SettingsHeading,
  SettingsListRow,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The scheduled mail before it answers: its heading, then one row on
 * `SettingsListRow`'s own frame, the subject over who and from where, the
 * time, and Cancel.
 */
export function ScheduledMailSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="mt-8 flex flex-col gap-3" aria-busy>
      <SettingsHeading>{t('settings.mail.scheduledTitle')}</SettingsHeading>
      <SettingsGroup>
        <SettingsListRow
          align="center"
          aria-hidden
          meta={<Skeleton shape="sm" className="h-2.5 w-56" />}
          kind={<Skeleton shape="sm" className="h-2 w-28" />}
          actions={<Skeleton shape="pill" className="h-7 w-16" />}
        >
          <Skeleton shape="sm" className="h-3 w-32" />
        </SettingsListRow>
      </SettingsGroup>
      <LoadingStatus />
    </div>
  );
}
