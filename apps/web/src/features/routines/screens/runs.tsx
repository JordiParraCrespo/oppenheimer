import {
  OverviewPage,
  OverviewPageBody,
  RunsList,
  RunsListEmpty,
} from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { OverviewTop } from '../sections/overview-top';

/**
 * The automations overview on its Runs tab
 * (`product/versions/mvp/13-automations.md`): every run across the
 * workspace's automations, filtered by state and by automation, paged. The
 * frame, built ahead of the rows: the filters, the rows and the foot arrive
 * with the API behind runs.
 */
export function RunsScreen() {
  const { t } = useTranslation();

  return (
    <OverviewPage>
      <OverviewPageBody>
        <OverviewTop tab="runs" />
        <RunsList>
          <RunsListEmpty>{t('automations.page.runsEmpty')}</RunsListEmpty>
        </RunsList>
      </OverviewPageBody>
    </OverviewPage>
  );
}
