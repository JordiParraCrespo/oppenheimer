import { createFileRoute } from '@tanstack/react-router';
import { NewSessionScreen } from '@/features/sessions/screens/new-session';

/**
 * New session. `full`, like the rest of `/sessions`: the composer is the
 * console's main pane in the artboards, not a page inside it.
 */
export const Route = createFileRoute('/_authenticated/sessions/new')({
  component: NewSessionScreen,
  staticData: { pane: 'full' },
});
