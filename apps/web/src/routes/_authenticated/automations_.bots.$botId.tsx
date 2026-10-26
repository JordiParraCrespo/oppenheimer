import { createFileRoute } from '@tanstack/react-router';
import { BotChatScreen } from '@/features/bots/screens/bot-chat';

/**
 * `/automations/bots/$botId`: a bot's chat inside Automations, beside the section's own sidebar
 * (`product/versions/mvp/28-bots-in-sections.md`). The same chat as
 * `/bots/$botId`, the same conversation; only the list beside the rail
 * differs, which the address decides (`useConsoleList`). Un-nested (`automations_`) from the `wide` page, since the chat takes the whole pane.
 */
export const Route = createFileRoute('/_authenticated/automations_/bots/$botId')({
  staticData: { pane: 'full', bar: 'own' },
  component: AutomationsBotChatRoute,
});

function AutomationsBotChatRoute() {
  const { botId } = Route.useParams();
  // Keyed, so moving between two bots starts the chat afresh (its draft included).
  return <BotChatScreen key={botId} botId={botId} />;
}
