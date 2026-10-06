import { QueueHeader } from '../sections/queue-header';
import { QueueScopes } from '../sections/queue-scopes';
import { QueueTable } from '../sections/queue-table';

/** The PR queue: the header and Review next, the scopes, the table. */
export function PullRequestQueueScreen() {
  return (
    <>
      <QueueHeader />
      <QueueScopes />
      <QueueTable />
    </>
  );
}
