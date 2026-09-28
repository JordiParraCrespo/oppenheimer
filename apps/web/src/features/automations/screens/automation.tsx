import { EditorPageBack, EmptyState, Skeleton } from '@oppenheimer/design-system-web';
import { useAutomation } from '@oppenheimer/frontend-consumer/react';
import { AppError } from '@oppenheimer/frontend-core';
import { QueryState, RouteError } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AutomationHeader } from '../sections/automation-header';
import { RunHistoryCard } from '../sections/run-history-card';
import { RunsTable } from '../sections/runs-table';

/**
 * An automation's page (`product/versions/mvp/13-automations.md`): Back, its
 * header, its run history and its runs. The screen reads the automation
 * because it branches on it — loading, failed, gone, or there — and the sections
 * under it read their own data by its id.
 */
export function AutomationScreen({ automationId }: { automationId: string }) {
  const { t } = useTranslation();
  const automation = useAutomation(automationId);

  // Only a 404 is "not found"; any other failure is a failure, and says so.
  if (automation.error instanceof AppError && automation.error.status === 404) {
    return (
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Description>{t('automations.detail.notFound')}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    );
  }
  return (
    <QueryState
      query={automation}
      pending={
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-11 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      }
      errorFallback={t('errors.fallback')}
      renderError={(error) => <RouteError error={error} />}
    >
      {(data) => (
        <div className="flex flex-col gap-4">
          <EditorPageBack render={<Link to="/automations" />}>
            {t('automations.detail.back')}
          </EditorPageBack>
          <AutomationHeader automation={data} />
          <RunHistoryCard automationId={automationId} />
          <RunsTable automationId={automationId} />
        </div>
      )}
    </QueryState>
  );
}
