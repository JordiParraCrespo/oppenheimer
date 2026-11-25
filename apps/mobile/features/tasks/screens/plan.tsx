import { AccountButton, TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';
import { PlanBoard } from '../sections/plan-board';

/** The Plan tab: your tasks, as the console's board lays them out, one column after another. */
export function PlanScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.plan')} trailing={<AccountButton href="/account" />}>
      <PlanBoard />
    </TabScreen>
  );
}
