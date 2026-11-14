import { Terminal } from '@oppenheimer/design-system-mobile/icons';
import { TabPlaceholder, TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';

/** The Sessions tab. The list comes in a later slice; for now it says so. */
export function SessionsScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.sessions')}>
      <TabPlaceholder icon={Terminal} description={t('nav.mobile.sessions')} />
    </TabScreen>
  );
}
