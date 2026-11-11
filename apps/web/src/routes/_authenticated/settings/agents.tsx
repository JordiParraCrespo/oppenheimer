import { createFileRoute } from '@tanstack/react-router';
import { AgentsSettingsScreen } from '@/features/sessions/screens/agents-settings';

/** Settings → Agents: which agents New session's engine picker offers on this device. */
export const Route = createFileRoute('/_authenticated/settings/agents')({
  component: AgentsSettingsScreen,
});
