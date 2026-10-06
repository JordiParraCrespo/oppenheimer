import { createFileRoute } from '@tanstack/react-router';
import { analyticsSearchSchema } from '@/features/pull-requests/lib/analytics-search';
import { PullRequestAnalyticsScreen } from '@/features/pull-requests/screens/pull-request-analytics';

export const Route = createFileRoute('/_authenticated/pulls/analytics')({
  validateSearch: analyticsSearchSchema,
  component: PullRequestAnalyticsScreen,
});
