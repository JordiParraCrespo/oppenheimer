import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * The console on its automations list (`product/versions/mvp/13-automations.md`).
 * `list: 'automations'` is what swaps the sidebar beside the rail for the
 * automations list; the pane is `full`, like the rest of the console, because
 * every page under here scrolls its own column.
 */
export const Route = createFileRoute('/_authenticated/automations')({
  component: Outlet,
  staticData: { list: 'automations', pane: 'full' },
});
