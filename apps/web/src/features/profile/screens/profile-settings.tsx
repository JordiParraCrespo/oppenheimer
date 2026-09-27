import { Callout, SettingsTitle } from '@oppenheimer/design-system-web';
import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AccountSection } from '../sections/account';
import { DevicesSection } from '../sections/devices';
import { ProfileDetailsSection } from '../sections/profile-details';
import { SignInSection } from '../sections/sign-in';

/**
 * Settings → Profile (`design/version1/Settings.dc.html`): the title, the
 * account's facts — picture, email, name, username — then how it signs in
 * and the devices that have, and the one destructive setting last.
 *
 * The screen fetches nothing: each section subscribes to what it draws, so
 * saving the name does not redraw the device list.
 */
export function ProfileSettingsScreen() {
  const { t } = useTranslation();
  const { emailChanged } = useSearch({ from: '/_authenticated/settings/profile' });

  return (
    <>
      <SettingsTitle title={t('settings.profile.title')} />
      {emailChanged ? <Callout tone="success">{t('settings.profile.emailChanged')}</Callout> : null}
      <ProfileDetailsSection />
      <SignInSection />
      <DevicesSection />
      <AccountSection />
    </>
  );
}
