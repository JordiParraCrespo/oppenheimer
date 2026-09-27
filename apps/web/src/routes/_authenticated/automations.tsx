import { EditorPage, EditorPageBody } from '@oppenheimer/design-system-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { OverviewTop } from '@/features/automations/sections/overview-top';

/**
 * The automations overview (`product/versions/mvp/13-automations.md`): one
 * frame — the wide page body, the view tabs and New automation — mounted
 * here once, and the view under the tabs is the child route's. The list
 * beside the rail is the address's (`useConsoleList`), so this layout has
 * nothing to declare. `full`, because the frame scrolls its own column.
 */
export const Route = createFileRoute('/_authenticated/automations')({
  component: AutomationsLayout,
  staticData: { pane: 'full' },
});

function AutomationsLayout() {
  return (
    <EditorPage>
      <EditorPageBody wide>
        <OverviewTop />
        <Outlet />
      </EditorPageBody>
    </EditorPage>
  );
}
