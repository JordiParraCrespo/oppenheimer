import { createFileRoute } from '@tanstack/react-router';
import { WhatsappSettingsScreen } from '@/features/whatsapp/screens/whatsapp-settings';

/** Settings → WhatsApp: the reader's own numbers, linked on their hosts for their bots. */
export const Route = createFileRoute('/_authenticated/settings/whatsapp')({
  component: WhatsappSettingsScreen,
});
