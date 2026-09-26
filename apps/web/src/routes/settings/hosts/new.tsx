import { createFileRoute } from '@tanstack/react-router';
import { AddHostScreen } from '@/features/hosts/screens/add-host';

/**
 * Add a host, from Settings: the same page as `/hosts/new`, drawn in the
 * settings column with Hosts as its parent crumb, and Done rather than Use
 * this host, because nothing here is picking a machine for a session.
 */
export const Route = createFileRoute('/settings/hosts/new')({
  component: () => <AddHostScreen from="settings" />,
});
