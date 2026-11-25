import { AccountButton, TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';
import { SessionsList } from '../sections/sessions-list';

/** The Sessions tab: every session of yours, the ones waiting on you first. */
export function SessionsScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.sessions')} trailing={<AccountButton href="/account" />}>
      <SessionsList />
    </TabScreen>
  );
}
