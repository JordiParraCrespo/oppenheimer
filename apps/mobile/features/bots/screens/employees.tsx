import { Bot } from '@oppenheimer/design-system-mobile/icons';
import { TabPlaceholder, TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';

/** The Employees tab. The list comes in a later slice; for now it says so. */
export function EmployeesScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.employees')}>
      <TabPlaceholder icon={Bot} description={t('common.comingToMobile.employees')} />
    </TabScreen>
  );
}
