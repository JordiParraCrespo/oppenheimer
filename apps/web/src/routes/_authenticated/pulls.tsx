import { EditorPage, EditorPageBody } from '@oppenheimer/design-system-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * The Pull requests pages (`product/next-steps/0.2-pull-requests.md`, drawn in
 * `product/versions/mvp/design/version1/PullRequests.dc.html`): one wide page
 * body for the queue and analytics. A pull request itself is un-nested
 * (`pulls_`), because its bar and its diff take the whole pane. The list
 * beside the rail is the address's (`useConsoleList`).
 */
export const Route = createFileRoute('/_authenticated/pulls')({
  component: PullRequestsLayout,
  staticData: { pane: 'full' },
});

function PullRequestsLayout() {
  return (
    <EditorPage>
      <EditorPageBody wide>
        <Outlet />
      </EditorPageBody>
    </EditorPage>
  );
}
