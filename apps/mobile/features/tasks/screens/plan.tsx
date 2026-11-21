import { Layers } from '@oppenheimer/design-system-mobile/icons';
import { AccountButton, TabPlaceholder, TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';

/** The Plan tab: the tasks, as the console's rail calls it. Its board comes in a later slice. */
export function PlanScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.plan')} trailing={<AccountButton href="/account" />}>
      <TabPlaceholder icon={Layers} description={t('common.comingToMobile.plan')} />
    </TabScreen>
  );
}
