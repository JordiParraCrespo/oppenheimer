import { SettingsTitle } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { VersionsSection } from '../sections/versions';

/** Settings → About: the versions this console and its API run. */
export function AboutSettingsScreen() {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle title={t('settings.about.title')} />
      <VersionsSection />
    </>
  );
}
