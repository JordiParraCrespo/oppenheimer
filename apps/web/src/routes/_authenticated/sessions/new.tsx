import { createFileRoute } from '@tanstack/react-router';
import { newSessionSearchSchema } from '@/features/sessions/lib/new-session-search';
import { NewSessionScreen } from '@/features/sessions/screens/new-session';

/**
 * New session. `full`, like the rest of `/sessions`: the composer is the
 * console's main pane in the artboards, not a page inside it.
 *
 * `?project=` is the sidebar's "New session here" and what a new project
 * lands with: the project chip starts on that project and its defaults
 * prefill the rest (`product/versions/mvp/05-screens.md`); with none, the
 * project the chip starts on prefills them the same way.
 * `?host=` is what Add a host lands with: the host chip starts on the
 * machine it paired (`newSessionSearchSchema`).
 */
export const Route = createFileRoute('/_authenticated/sessions/new')({
  component: NewSessionScreen,
  staticData: { pane: 'full' },
  validateSearch: newSessionSearchSchema,
});
