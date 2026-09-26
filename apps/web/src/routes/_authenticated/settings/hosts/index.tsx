import { createFileRoute } from '@tanstack/react-router';
import { HostsSettingsScreen } from '@/features/hosts/screens/hosts-settings';

/**
 * Settings → Hosts: the machines the workspace's sessions run on. Add host
 * is the console's one pairing page, `/hosts/new?from=settings`.
 */
export const Route = createFileRoute('/_authenticated/settings/hosts/')({
  component: HostsSettingsScreen,
});
