import { createFileRoute } from '@tanstack/react-router';
import { SessionScreen } from '@/features/sessions/screens/session';
import { SessionTaskLink } from '@/features/tasks/sections/session-task-link';

/**
 * One session. The screen owns the pane — a terminal sizes itself from the box
 * it is given, so the shell gives it the whole one and keeps no scroll of its
 * own; `staticData.pane` is read by `AppShell`.
 */
export const Route = createFileRoute('/_authenticated/sessions/$sessionId')({
  component: SessionRoute,
  staticData: { pane: 'full' },
});

function SessionRoute() {
  const { sessionId } = Route.useParams();

  // Keyed by the id: moving between two sessions is a different terminal, a
  // different socket and a different scrollback, not the same component with
  // new props. Without it xterm would keep the previous session's grid.
  // The task chip is the tasks feature's: the route composes the two.
  return (
    <SessionScreen
      key={sessionId}
      sessionId={sessionId}
      statusItem={<SessionTaskLink sessionId={sessionId} />}
    />
  );
}
