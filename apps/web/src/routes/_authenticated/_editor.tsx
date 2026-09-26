import { EditorPage, EditorPageBody } from '@oppenheimer/design-system-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * The pages over the main column: New project, Project settings, Add a host,
 * and the automation editor when it lands. One frame, mounted here once —
 * the canvas column that scrolls on its own and the 760px body — and each
 * page under it fills the body with its Back pill, its page header and its
 * steps (`design/version1/SessionsConsole.dc.html`, `op-rpage`).
 *
 * Pathless, so it adds no segment: `/projects/new` and `/hosts/new` are the
 * URLs they were. `full`, because the frame scrolls its own column, as the
 * console's panes do; the pages under it inherit that.
 */
export const Route = createFileRoute('/_authenticated/_editor')({
  component: EditorLayout,
  staticData: { pane: 'full' },
});

function EditorLayout() {
  return (
    <EditorPage>
      <EditorPageBody>
        <Outlet />
      </EditorPageBody>
    </EditorPage>
  );
}
