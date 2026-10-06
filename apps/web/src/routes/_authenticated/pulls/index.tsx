import { createFileRoute } from '@tanstack/react-router';
import { queueSearchSchema } from '@/features/pull-requests/lib/queue-search';
import { PullRequestQueueScreen } from '@/features/pull-requests/screens/pull-request-queue';

export const Route = createFileRoute('/_authenticated/pulls/')({
  validateSearch: queueSearchSchema,
  component: PullRequestQueueScreen,
});
