import { AccountButton, TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';
import { EmployeesList } from '../sections/employees-list';

/** The Employees tab: your bots by team, each opening its chat. */
export function EmployeesScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.employees')} trailing={<AccountButton href="/account" />}>
      <EmployeesList />
    </TabScreen>
  );
}
