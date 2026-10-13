import { createFileRoute } from '@tanstack/react-router';
import { planScopeSearchSchema } from '@/features/tasks/lib/plan-scope';
import { MilestonesScreen } from '@/features/tasks/screens/milestones';

/**
 * Plan's Milestones (`product/versions/mvp/23-plan-milestones-stats-accounts.md`
 * §1): the timeline and the milestone cards; `?project=` narrows them.
 */
export const Route = createFileRoute('/_authenticated/plan/milestones')({
  validateSearch: planScopeSearchSchema,
  component: MilestonesScreen,
});
