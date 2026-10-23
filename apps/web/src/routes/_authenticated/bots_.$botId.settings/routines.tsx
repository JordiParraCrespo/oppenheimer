import { createFileRoute } from '@tanstack/react-router';
import { BotRoutinesScreen } from '@/features/bots/screens/bot-routines';

export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/routines')({
  component: BotRoutinesRoute,
});

function BotRoutinesRoute() {
  const { botId } = Route.useParams();
  return <BotRoutinesScreen botId={botId} />;
}
