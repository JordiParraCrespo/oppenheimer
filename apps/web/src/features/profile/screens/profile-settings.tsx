import {
  SettingsGroup,
  SettingsRow,
  SettingsTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useProfile } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';

/**
 * Settings → Profile (`design/version1/Settings.dc.html`): the title, then
 * the account's facts as settings rows. The export's rows — picture, name,
 * email, password — are the profile slice's; this is the page they land on,
 * with the one row that needs no form.
 */
export function ProfileSettingsScreen() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();

  return (
    <>
      <SettingsTitle title={t('settings.profile.title')} />
      <SettingsGroup>
        <SettingsRow label={t('settings.profile.email')} hint={t('settings.profile.emailHint')}>
          {profile ? (
            <span className="text-fg-muted">{profile.email}</span>
          ) : (
            <Skeleton className="h-5 w-40" />
          )}
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
