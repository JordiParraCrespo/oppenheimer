import { createFileRoute } from '@tanstack/react-router';

/**
 * Cloud agents (`product/next-steps/cloud-agents.md`): coding agents run in a
 * vendor's cloud on the reader's own key. Launching one and following one are
 * each a page at the `narrow` measure; the agents are listed beside the rail
 * (`useConsoleList`).
 */
export const Route = createFileRoute('/_authenticated/cloud')({
  staticData: { pane: 'narrow' },
});
