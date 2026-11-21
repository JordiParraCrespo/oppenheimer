import { Terminal } from '@oppenheimer/design-system-mobile/icons';
import { AccountButton, TabPlaceholder, TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';

/** The Sessions tab. The list comes in a later slice; for now it says so. */
export function SessionsScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.sessions')} trailing={<AccountButton href="/account" />}>
      <TabPlaceholder icon={Terminal} description={t('common.comingToMobile.sessions')} />
    </TabScreen>
  );
}
