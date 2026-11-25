import { AccountButton, TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';
import { AutomationsList } from '../sections/automations-list';

/** The Automations tab: every automation of the workspace, each with the switch that pauses it. */
export function AutomationsScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.automations')} trailing={<AccountButton href="/account" />}>
      <AutomationsList />
    </TabScreen>
  );
}
