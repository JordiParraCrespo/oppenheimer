import { EmptyState, Skeleton } from '@oppenheimer/design-system-web';
import { AppError } from '@oppenheimer/frontend-core';
import { QueryState, RouteError } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { AutomationDetail } from '../sections/automation-detail';

/**
 * An automation's page (`product/versions/mvp/13-automations.md`). The page
 * reads the automation under Suspense; the screen draws the rungs around it —
 * loading, failed, gone — and `AutomationDetail` draws it once it is there.
 */
export function AutomationScreen({ automationId }: { automationId: string }) {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-11 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </QueryState.Pending>
      {/* Only a 404 is "not found"; any other failure is a failure, and says so. */}
      <QueryState.Error>
        {(error) =>
          error instanceof AppError && error.status === 404 ? (
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Description>{t('automations.detail.notFound')}</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ) : (
            <RouteError error={error} />
          )
        }
      </QueryState.Error>
      <QueryState.Data>
        <AutomationDetail automationId={automationId} />
      </QueryState.Data>
    </QueryState>
  );
}
