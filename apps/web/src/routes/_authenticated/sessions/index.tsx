import { createFileRoute } from '@tanstack/react-router';
import { SessionsScreen } from '@/features/sessions/screens/sessions';

/**
 * The console's own URL. The pane is `full` like every screen under
 * `/sessions`: what goes here is a terminal, and a landing that does not fill
 * the same space would make the console jump on every open and close.
 */
export const Route = createFileRoute('/_authenticated/sessions/')({
  component: SessionsScreen,
  staticData: { pane: 'full' },
});
