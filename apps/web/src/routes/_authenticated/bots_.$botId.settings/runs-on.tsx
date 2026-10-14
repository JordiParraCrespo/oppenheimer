import { createFileRoute } from '@tanstack/react-router';
import { BotRunsOnScreen } from '@/features/bots/screens/bot-runs-on';

export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/runs-on')({
  component: BotRunsOnRoute,
});

function BotRunsOnRoute() {
  const { botId } = Route.useParams();
  return <BotRunsOnScreen botId={botId} />;
}
