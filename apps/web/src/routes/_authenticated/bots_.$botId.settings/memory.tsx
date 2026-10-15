import { createFileRoute } from '@tanstack/react-router';
import { BotMemoryScreen } from '@/features/bots/screens/bot-memory';

export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/memory')({
  component: BotMemoryRoute,
});

function BotMemoryRoute() {
  const { botId } = Route.useParams();
  return <BotMemoryScreen botId={botId} />;
}
