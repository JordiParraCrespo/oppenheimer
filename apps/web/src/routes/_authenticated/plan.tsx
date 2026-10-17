import { PageBar } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * Plan (`product/versions/mvp/18-plan-product.md`): the board, the calendar
 * and Google's return from its consent screen, each a page at the `board`
 * measure, the width of four columns. The shell draws the frame (`pane` in
 * the web kit's `shell/lib/pane.ts`), so this layout only declares it and
 * renders its `Outlet` under the bar every page opens with (`PageBar`), the
 * sidebar toggle in it; each page's display header names it below.
 */
export const Route = createFileRoute('/_authenticated/plan')({
  staticData: { pane: 'board' },
  component: PlanLayout,
});

function PlanLayout() {
  return (
    <>
      <PageBar />
      <Outlet />
    </>
  );
}
