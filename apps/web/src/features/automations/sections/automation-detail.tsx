import { EditorPageBack } from '@oppenheimer/design-system-web';
import { useSuspenseAutomation } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RunHistorySkeleton } from '../components/run-history-skeleton';
import { RunsSkeleton } from '../components/runs-skeleton';
import { AutomationHeader } from './automation-header';
import { RunHistoryCard } from './run-history-card';
import { RunsTable } from './runs-table';

/**
 * An automation's page once it is there, in `AutomationScreen`'s
 * `QueryState.Data`: Back, its header, its run history and its runs. It reads
 * the automation under Suspense; the sections under it read their own data
 * by its id. A refetch that fails keeps the page and says so above it.
 */
export function AutomationDetail({ automationId }: { automationId: string }) {
  const { t } = useTranslation();
  const { data: automation, error } = useSuspenseAutomation(automationId);

  return (
    <div className="flex flex-col gap-4">
      <EditorPageBack render={<Link to="/automations" />}>
        {t('automations.detail.back')}
      </EditorPageBack>
      <ErrorAlert error={error} fallback={t('automations.detail.loadFailed')} />
      <AutomationHeader automation={automation} />
      <QueryState>
        <QueryState.Pending>
          <RunHistorySkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.history.loadFailed')} />
        <QueryState.Data>
          <RunHistoryCard automationId={automationId} />
        </QueryState.Data>
      </QueryState>
      <QueryState>
        <QueryState.Pending>
          <RunsSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.runs.loadFailed')} />
        <QueryState.Data>
          <RunsTable automationId={automationId} />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
