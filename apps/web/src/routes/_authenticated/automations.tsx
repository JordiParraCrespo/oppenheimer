import { EditorPage, EditorPageBody } from '@oppenheimer/design-system-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * The automations pages (`product/versions/mvp/13-automations.md`): one
 * frame — the wide page body — mounted here once; the overview's two tabs and
 * an automation's page are the child routes. The list beside the rail is the
 * address's (`useConsoleList`), so this layout has nothing to declare.
 * `full`, because the frame scrolls its own column.
 */
export const Route = createFileRoute('/_authenticated/automations')({
  component: AutomationsLayout,
  staticData: { pane: 'full' },
});

function AutomationsLayout() {
  return (
    <EditorPage>
      <EditorPageBody wide>
        <Outlet />
      </EditorPageBody>
    </EditorPage>
  );
}
