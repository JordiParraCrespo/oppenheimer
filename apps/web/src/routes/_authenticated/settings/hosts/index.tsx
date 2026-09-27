import { createFileRoute } from '@tanstack/react-router';
import { HostsSettingsScreen } from '@/features/hosts/screens/hosts-settings';

/**
 * Settings → Hosts: the machines the workspace's sessions run on. Add host
 * opens inside Settings, at `/settings/hosts/new`.
 */
export const Route = createFileRoute('/_authenticated/settings/hosts/')({
  component: HostsSettingsScreen,
});
