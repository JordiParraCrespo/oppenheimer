import { createFileRoute } from '@tanstack/react-router';
import { CloudAgentScreen } from '@/features/cloud-agents/screens/cloud-agent';

/** `/cloud/$agentId`: one cloud agent, followed while it works, and its next instruction. */
export const Route = createFileRoute('/_authenticated/cloud/$agentId')({
  component: CloudAgentRoute,
});

function CloudAgentRoute() {
  const { agentId } = Route.useParams();
  // Keyed, so moving between two agents starts the page afresh (its draft included).
  return <CloudAgentScreen key={agentId} agentId={agentId} />;
}
