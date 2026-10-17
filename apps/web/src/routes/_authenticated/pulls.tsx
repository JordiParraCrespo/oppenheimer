import { PageBar } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * The Pull requests pages (`product/next-steps/0.2-pull-requests.md`, drawn in
 * `product/versions/mvp/design/version1/PullRequests.dc.html`): the queue and
 * analytics, each a page at the `wide` measure, the automations' width. The
 * shell draws the frame (`pane` in the web kit's `shell/lib/pane.ts`), so
 * this layout only declares it and renders its `Outlet` under the bar every
 * page opens with (`PageBar`), the sidebar toggle in it. A pull request
 * itself is un-nested (`pulls_`), because its bar and its diff take the whole
 * pane. The list beside the rail is the address's (`useConsoleList`).
 */
export const Route = createFileRoute('/_authenticated/pulls')({
  staticData: { pane: 'wide' },
  component: PullsLayout,
});

function PullsLayout() {
  return (
    <>
      <PageBar />
      <Outlet />
    </>
  );
}
