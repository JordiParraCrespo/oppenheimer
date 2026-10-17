import { createFileRoute } from '@tanstack/react-router';
import { BotProfileScreen } from '@/features/bots/screens/bot-profile';

export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/profile')({
  component: BotProfileRoute,
});

function BotProfileRoute() {
  const { botId } = Route.useParams();
  return <BotProfileScreen botId={botId} />;
}
