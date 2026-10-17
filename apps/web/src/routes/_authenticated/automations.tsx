import { createFileRoute } from '@tanstack/react-router';

/**
 * The automations pages (`product/versions/mvp/13-automations.md`): the
 * overview's two tabs and an automation's page are the child routes, each a
 * page at the `wide` measure, which holds a table. The shell draws the frame
 * (`pane` in the web kit's `shell/lib/pane.ts`), so this layout only declares
 * it and renders its `Outlet`; the list beside the rail is the matched
 * route's (`useConsoleList`). A run's terminal is un-nested
 * (`automations_.$automationId.sessions.$sessionId.tsx`) and takes the pane.
 */
export const Route = createFileRoute('/_authenticated/automations')({
  staticData: { pane: 'wide' },
});
