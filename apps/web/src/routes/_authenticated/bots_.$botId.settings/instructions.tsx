import { createFileRoute } from '@tanstack/react-router';
import { BotInstructionsScreen } from '@/features/bots/screens/bot-instructions';

export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/instructions')({
  component: BotInstructionsRoute,
});

function BotInstructionsRoute() {
  const { botId } = Route.useParams();
  return <BotInstructionsScreen botId={botId} />;
}
