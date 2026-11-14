import { GitPullRequest } from '@oppenheimer/design-system-mobile/icons';
import { TabPlaceholder, TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';

/** The Pull requests tab. The list comes in a later slice; for now it says so. */
export function PullRequestsScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.pullRequests')}>
      <TabPlaceholder icon={GitPullRequest} description={t('common.comingToMobile.pullRequests')} />
    </TabScreen>
  );
}
