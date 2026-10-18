import { createFileRoute, Link } from '@tanstack/react-router';
import { RunClosed } from '@/features/automations/sections/run-closed';
import { SessionScreen } from '@/features/sessions/screens/session';

/**
 * A run, opened from the automations list (the frame's run view): the session
 * the run started, in the whole pane, while the sidebar stays on the
 * automations — the address is under `/automations`, which is what the shell
 * reads the list from. Un-nested from the automations layout (`automations_`),
 * because a terminal sizes itself from the pane and the overview's page body
 * would box it in.
 *
 * The route is where the two features meet, which is the only place they may:
 * the terminal is `sessions`, and what a *run* says when its terminal is gone
 * is `automations`. The session screen draws the pane and hands this one the
 * closed state to fill, so neither feature imports the other.
 */
export const Route = createFileRoute(
  '/_authenticated/automations_/$automationId/sessions/$sessionId',
)({
  component: RunSessionRoute,
  staticData: { pane: 'full' },
});

function RunSessionRoute() {
  const { automationId, sessionId } = Route.useParams();
  // Keyed like the sessions route: another run is another terminal.
  return (
    <SessionScreen
      key={sessionId}
      sessionId={sessionId}
      closed={({ branch, restart, restarting }) => (
        <RunClosed
          branch={branch}
          onOpen={restart}
          opening={restarting}
          backToAutomation={<Link to="/automations/$automationId" params={{ automationId }} />}
        />
      )}
    />
  );
}
