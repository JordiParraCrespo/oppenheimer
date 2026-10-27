import { createFileRoute } from '@tanstack/react-router';
import { CloudAgentsLandingScreen } from '@/features/cloud-agents/screens/cloud-agents-landing';

/** `/cloud`, the rail's Cloud agents: launch one, or connect a vendor first. */
export const Route = createFileRoute('/_authenticated/cloud/')({
  component: CloudAgentsLandingScreen,
});
