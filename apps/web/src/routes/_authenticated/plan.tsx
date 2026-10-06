import { createFileRoute } from '@tanstack/react-router';

/**
 * Plan (`product/versions/mvp/18-plan-product.md`): the board, the calendar
 * and Google's return from its consent screen, each a page at the `board`
 * measure, the width of four columns. The shell draws the frame (`pane` in
 * the web kit's `shell/lib/pane.ts`), so this layout only declares it and
 * renders its `Outlet`.
 */
export const Route = createFileRoute('/_authenticated/plan')({
  staticData: { pane: 'board' },
});
