import {
  Alert,
  AlertDescription,
  SettingsGroup,
  SettingsRow,
  SettingsTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useErrorMessage, useProfile } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';

/**
 * Settings → Profile (`design/version1/Settings.dc.html`): the title, then
 * the account's facts as settings rows. The export's rows — picture, name,
 * email, password — are the profile slice's; this is the page they land on,
 * with the one row that needs no form.
 */
export function ProfileSettingsScreen() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const profile = useProfile();

  return (
    <>
      <SettingsTitle title={t('settings.profile.title')} />
      {profile.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(profile.error, t('settings.profile.failed')).message}
          </AlertDescription>
        </Alert>
      ) : (
        <SettingsGroup>
          <SettingsRow label={t('settings.profile.email')} hint={t('settings.profile.emailHint')}>
            {profile.data ? (
              <span className="text-fg-muted">{profile.data.email}</span>
            ) : (
              <Skeleton className="h-5 w-40" />
            )}
          </SettingsRow>
        </SettingsGroup>
      )}
    </>
  );
}
