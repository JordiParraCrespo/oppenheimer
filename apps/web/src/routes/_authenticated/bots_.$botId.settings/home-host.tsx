import { createFileRoute } from '@tanstack/react-router';
import { BotHomeHostScreen } from '@/features/bots/screens/bot-home-host';

export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/home-host')({
  component: BotHomeHostRoute,
});

function BotHomeHostRoute() {
  const { botId } = Route.useParams();
  return <BotHomeHostScreen botId={botId} />;
}
