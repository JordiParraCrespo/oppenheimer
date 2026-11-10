import { EditorPageBack, EmptyState } from '@oppenheimer/design-system-web';
import { AppError } from '@oppenheimer/frontend-core';
import { QueryState, RouteError } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AutomationHeaderSkeleton } from '../components/automation-header-skeleton';
import { RunHistorySkeleton } from '../components/run-history-skeleton';
import { RunsSkeleton } from '../components/runs-skeleton';
import { useRunsFilters } from '../hooks/use-runs-filters';
import { AutomationDetail } from '../sections/automation-detail';

/**
 * An automation's page (`product/versions/mvp/13-automations.md`). The page
 * reads the automation under Suspense; the screen draws the rungs around it —
 * loading, failed, gone — and `AutomationDetail` draws it once it is there.
 * While it loads, the page's own parts stand in: Back, the header's shape and
 * the same run-history and runs placeholders the page's nested boundaries
 * draw, so those swap like for like when the automation lands.
 */
export function AutomationScreen({ automationId }: { automationId: string }) {
  const { t } = useTranslation();
  const { state } = useRunsFilters({ automationId });

  return (
    <QueryState>
      <QueryState.Pending>
        <div className="flex flex-col gap-4">
          <EditorPageBack render={<Link to="/automations" />}>
            {t('automations.detail.back')}
          </EditorPageBack>
          <AutomationHeaderSkeleton />
          <RunHistorySkeleton />
          <RunsSkeleton status={state.status} window={state.window} />
        </div>
      </QueryState.Pending>
      {/* Only a 404 is "not found"; any other failure is a failure, says so, and
          tries again through the boundary. */}
      <QueryState.Error>
        {(error, retry) =>
          error instanceof AppError && error.status === 404 ? (
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Description>{t('automations.detail.notFound')}</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ) : (
            <RouteError error={error} onRetry={retry} />
          )
        }
      </QueryState.Error>
      <QueryState.Data>
        <AutomationDetail automationId={automationId} />
      </QueryState.Data>
    </QueryState>
  );
}
