import { createFileRoute } from '@tanstack/react-router';
import { CloudAgentsSettingsScreen } from '@/features/cloud-agents/screens/cloud-agents-settings';

/** Settings → Cloud agents: the reader's own keys for the vendors cloud agents run on. */
export const Route = createFileRoute('/_authenticated/settings/cloud-agents')({
  component: CloudAgentsSettingsScreen,
});
