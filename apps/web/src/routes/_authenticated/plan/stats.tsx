import { createFileRoute } from '@tanstack/react-router';
import { statsSearchSchema } from '@/features/tasks/lib/stats';
import { StatsScreen } from '@/features/tasks/screens/stats';

/**
 * Plan's Stats (`product/versions/mvp/23-plan-milestones-stats-accounts.md`
 * §4): `?range=` a preset (eight weeks by default) or `?from=` and `?to=`,
 * `?compare=off` to drop the previous period, `?project=` one project.
 */
export const Route = createFileRoute('/_authenticated/plan/stats')({
  validateSearch: statsSearchSchema,
  component: StatsScreen,
});
