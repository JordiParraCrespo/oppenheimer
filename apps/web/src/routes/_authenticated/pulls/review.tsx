import { createFileRoute } from '@tanstack/react-router';
import { reviewSearchSchema } from '@/features/pull-requests/lib/review-deck';
import { PullRequestReviewScreen } from '@/features/pull-requests/screens/pull-request-review';

export const Route = createFileRoute('/_authenticated/pulls/review')({
  validateSearch: reviewSearchSchema,
  component: PullRequestReviewScreen,
});
