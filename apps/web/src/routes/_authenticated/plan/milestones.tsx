import { createFileRoute } from '@tanstack/react-router';
import { planFilterBeforeLoad } from '@/features/tasks/lib/plan-filter-memory';
import { planScopeSearchSchema } from '@/features/tasks/lib/plan-scope';
import { MilestonesScreen } from '@/features/tasks/screens/milestones';

/**
 * Plan's Milestones (`product/versions/mvp/23-plan-milestones-stats-accounts.md`
 * §1): the timeline, one track per project; `?project=` narrows it, and a
 * visit without it takes the one Milestones was last left with on this device.
 */
export const Route = createFileRoute('/_authenticated/plan/milestones')({
  validateSearch: planScopeSearchSchema,
  beforeLoad: planFilterBeforeLoad('milestones'),
  component: MilestonesScreen,
});
