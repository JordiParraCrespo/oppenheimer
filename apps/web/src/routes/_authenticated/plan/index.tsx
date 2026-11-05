import { createFileRoute, redirect } from '@tanstack/react-router';
import { boardSearchSchema } from '@/features/tasks/lib/board-search';
import { restorePlanFilters } from '@/features/tasks/lib/plan-filter-memory';
import { BoardScreen } from '@/features/tasks/screens/board';

/**
 * Plan's board (`product/versions/mvp/18-plan-product.md` §1): `?project=`
 * and `?milestone=` filter it, `?task=` opens a task (the session header's "Back
 * to task"), `?start=` the Start session dialog. A visit with no filter in
 * the address takes the one the board was last left with on this device.
 */
export const Route = createFileRoute('/_authenticated/plan/')({
  validateSearch: boardSearchSchema,
  beforeLoad: ({ search, preload }) => {
    if (preload) return;
    const restored = restorePlanFilters('board', search);
    if (restored)
      throw redirect({ to: '/plan', search: { ...search, ...restored }, replace: true });
  },
  component: BoardScreen,
});
