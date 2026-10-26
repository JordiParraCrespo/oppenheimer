import { createFileRoute } from '@tanstack/react-router';
import { BotChatScreen } from '@/features/bots/screens/bot-chat';

/**
 * `/sessions/bots/$botId`: a bot's chat inside Sessions, beside the section's own sidebar
 * (`product/versions/mvp/28-bots-in-sections.md`). The same chat as
 * `/bots/$botId`, the same conversation; only the list beside the rail
 * differs, which the address decides (`useConsoleList`). Sessions has no layout route, so the chat sits under it as it is.
 */
export const Route = createFileRoute('/_authenticated/sessions/bots/$botId')({
  staticData: { pane: 'full', bar: 'own' },
  component: SessionsBotChatRoute,
});

function SessionsBotChatRoute() {
  const { botId } = Route.useParams();
  // Keyed, so moving between two bots starts the chat afresh (its draft included).
  return <BotChatScreen key={botId} botId={botId} />;
}
