import { createFileRoute } from '@tanstack/react-router';
import { BotChatScreen } from '@/features/bots/screens/bot-chat';

/**
 * `/plan/bots/$botId`: a bot's chat inside Plan, beside the section's own sidebar
 * (`product/versions/mvp/28-bots-in-sections.md`). The same chat as
 * `/bots/$botId`, the same conversation; only the list beside the rail
 * differs, which the address decides (`useConsoleList`). Un-nested (`plan_`) from the `board` page, since the chat takes the whole pane.
 */
export const Route = createFileRoute('/_authenticated/plan_/bots/$botId')({
  staticData: { pane: 'full', bar: 'own' },
  component: PlanBotChatRoute,
});

function PlanBotChatRoute() {
  const { botId } = Route.useParams();
  // Keyed, so moving between two bots starts the chat afresh (its draft included).
  return <BotChatScreen key={botId} botId={botId} />;
}
