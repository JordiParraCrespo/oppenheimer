import { createFileRoute } from '@tanstack/react-router';
import { HostsScreen } from '@/features/hosts/screens/hosts';

/** Settings → Hosts: the machines a person has paired (`product/versions/mvp/13-hosts-settings.md`). */
export const Route = createFileRoute('/_authenticated/settings/hosts')({
  component: HostsScreen,
});
