import { createFileRoute } from '@tanstack/react-router';
import { BotGatewaysScreen } from '@/features/bots/screens/bot-gateways';

export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/gateways')({
  component: BotGatewaysRoute,
});

function BotGatewaysRoute() {
  const { botId } = Route.useParams();
  return <BotGatewaysScreen botId={botId} />;
}
