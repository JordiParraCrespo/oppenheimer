import { createFileRoute } from '@tanstack/react-router';
import { newSessionSearchSchema } from '@/features/sessions/lib/new-session-search';
import { NewSessionScreen } from '@/features/sessions/screens/new-session';

/**
 * New session: the composer at the pane's foot, at the `prompt` measure
 * (`NewSessionComposer.dc.html`). The pane is its drop zone (`usePaneDrop`).
 *
 * `?project=` and `?host=`: see `newSessionSearchSchema`.
 */
export const Route = createFileRoute('/_authenticated/sessions/new')({
  component: NewSessionScreen,
  staticData: { pane: 'prompt' },
  validateSearch: newSessionSearchSchema,
});
