import { createFileRoute } from '@tanstack/react-router';
import { newSessionSearchSchema } from '@/features/sessions/lib/new-session-search';
import { NewSessionScreen } from '@/features/sessions/screens/new-session';

/**
 * New session: the composer, centred in the pane at the `composer` measure
 * (the export's `.op-newsession`). The pane is its drop zone; the screen says
 * how (`outline="pane"`), the shell keeps the frame.
 *
 * `?project=` and `?host=`: see `newSessionSearchSchema`.
 */
export const Route = createFileRoute('/_authenticated/sessions/new')({
  component: NewSessionScreen,
  staticData: { pane: 'composer' },
  validateSearch: newSessionSearchSchema,
});
