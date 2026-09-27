import { RunsList, RunsListEmpty } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The overview's Runs view (`product/versions/mvp/13-automations.md`): every
 * run across the workspace's automations. None exist yet; the filters, the
 * rows and the pager arrive with the API.
 */
export function RunsTable() {
  const { t } = useTranslation();

  return (
    <RunsList>
      <RunsListEmpty>{t('automations.page.runsEmpty')}</RunsListEmpty>
    </RunsList>
  );
}
