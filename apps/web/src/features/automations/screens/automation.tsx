import { EmptyState, Skeleton } from '@oppenheimer/design-system-web';
import { useAutomation } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { AutomationHeader } from '../sections/automation-header';
import { RunHistoryCard } from '../sections/run-history-card';
import { RunsTable } from '../sections/runs-table';

/**
 * An automation's page (`product/versions/mvp/13-automations.md`): its
 * header, its run history and its runs. The screen reads the automation
 * because it branches on it — loading, gone, or there — and the sections
 * under it read their own data by its id.
 */
export function AutomationScreen({ automationId }: { automationId: string }) {
  const { t } = useTranslation();
  const automation = useAutomation(automationId);

  if (automation.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-11 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!automation.data) {
    return (
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Description>{t('automations.detail.notFound')}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      <AutomationHeader automation={automation.data} />
      <RunHistoryCard automationId={automationId} />
      <RunsTable automationId={automationId} />
    </div>
  );
}
