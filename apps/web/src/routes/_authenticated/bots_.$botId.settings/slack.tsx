import { createFileRoute } from '@tanstack/react-router';
import { BotSlackScreen } from '@/features/slack/screens/bot-slack';

export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/slack')({
  component: BotSlackRoute,
});

function BotSlackRoute() {
  const { botId } = Route.useParams();
  return <BotSlackScreen botId={botId} />;
}
