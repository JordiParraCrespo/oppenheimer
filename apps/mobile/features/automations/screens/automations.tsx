import { Zap } from '@oppenheimer/design-system-mobile/icons';
import { TabPlaceholder, TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';

/** The Automations tab. The list comes in a later slice; for now it says so. */
export function AutomationsScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.automations')}>
      <TabPlaceholder icon={Zap} description={t('nav.mobile.automations')} />
    </TabScreen>
  );
}
