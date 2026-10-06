import { createFileRoute } from '@tanstack/react-router';
import { boardSearchSchema } from '@/features/tasks/lib/board-search';
import { BoardScreen } from '@/features/tasks/screens/board';

/**
 * Plan's board (`product/versions/mvp/18-plan-product.md` §1): `?project=`
 * and `?goal=` filter it, `?task=` opens a task (the session header's "Back
 * to task"), `?start=` the Start session dialog.
 */
export const Route = createFileRoute('/_authenticated/plan/')({
  validateSearch: boardSearchSchema,
  component: BoardScreen,
});
