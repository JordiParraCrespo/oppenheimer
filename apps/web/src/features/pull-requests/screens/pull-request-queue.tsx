import { Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { QueueHeader } from '../sections/queue-header';
import { QueueScopes } from '../sections/queue-scopes';
import { QueueTable } from '../sections/queue-table';

/** The PR queue: the header and Review next, the scopes, the table, read under Suspense. */
export function PullRequestQueueScreen() {
  const { t } = useTranslation();
  return (
    <>
      <QueueHeader />
      <QueueScopes />
      <QueryState>
        <QueryState.Pending>
          <Skeleton className="h-80 w-full" />
        </QueryState.Pending>
        <QueryState.Error fallback={t('pullRequests.queue.loadFailed')} />
        <QueryState.Data>
          <QueueTable />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
