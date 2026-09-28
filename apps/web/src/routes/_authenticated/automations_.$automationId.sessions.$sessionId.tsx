import { RouteError } from '@oppenheimer/frontend-web';
import { createFileRoute } from '@tanstack/react-router';
import { SessionScreen } from '@/features/sessions/screens/session';

/**
 * A run, opened from the automations list (the frame's run view): the session
 * the run started, in the whole pane, while the sidebar stays on the
 * automations — the address is under `/automations`, which is what the shell
 * reads the list from. Un-nested from the automations layout (`automations_`),
 * because a terminal sizes itself from the pane and the overview's page body
 * would box it in.
 */
export const Route = createFileRoute(
  '/_authenticated/automations_/$automationId/sessions/$sessionId',
)({
  // Its own boundary, so a thrown render replaces this pane and not the
  // shell around it: without one the error climbs to `_authenticated`.
  errorComponent: RouteError,
  component: RunSessionRoute,
  staticData: { pane: 'full' },
});

function RunSessionRoute() {
  const { sessionId } = Route.useParams();
  // Keyed like the sessions route: another run is another terminal.
  return <SessionScreen key={sessionId} sessionId={sessionId} />;
}
