import { createFileRoute } from '@tanstack/react-router';
import { HostsSettingsScreen } from '@/features/hosts/screens/hosts-settings';

/** Settings → Hosts: the machines the workspace's sessions run on. */
export const Route = createFileRoute('/settings/hosts/')({
  component: HostsSettingsScreen,
});
