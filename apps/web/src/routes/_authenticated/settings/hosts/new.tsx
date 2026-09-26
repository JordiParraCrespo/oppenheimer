import { createFileRoute } from '@tanstack/react-router';
import { AddHostScreen } from '@/features/hosts/screens/add-host';

/**
 * Add a host from Settings → Hosts: the same page as the console's, drawn in
 * the Settings frame with its way back to the list
 * (`design/version1/Settings.dc.html`).
 */
export const Route = createFileRoute('/_authenticated/settings/hosts/new')({
  component: () => <AddHostScreen from="settings" />,
});
