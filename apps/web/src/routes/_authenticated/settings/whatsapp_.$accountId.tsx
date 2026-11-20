import { createFileRoute } from '@tanstack/react-router';
import { whatsappChatsSearchSchema } from '@/features/whatsapp/lib/chats-search';
import { WhatsappNumberScreen } from '@/features/whatsapp/screens/whatsapp-number';

/**
 * Settings → WhatsApp → one number: its default bot and every chat it has
 * seen, with who answers each. Un-nested from Settings → WhatsApp, which
 * renders no outlet.
 */
export const Route = createFileRoute('/_authenticated/settings/whatsapp_/$accountId')({
  validateSearch: whatsappChatsSearchSchema,
  component: WhatsappNumberRoute,
});

function WhatsappNumberRoute() {
  const { accountId } = Route.useParams();
  return <WhatsappNumberScreen accountId={accountId} />;
}
