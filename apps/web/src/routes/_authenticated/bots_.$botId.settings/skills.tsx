import { createFileRoute } from '@tanstack/react-router';
import { BotSkillsScreen } from '@/features/bots/screens/bot-skills';

export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/skills')({
  component: BotSkillsRoute,
});

function BotSkillsRoute() {
  const { botId } = Route.useParams();
  return <BotSkillsScreen botId={botId} />;
}
