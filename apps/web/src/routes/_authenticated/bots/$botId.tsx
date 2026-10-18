import { createFileRoute } from '@tanstack/react-router';
import { BotChatScreen } from '@/features/bots/screens/bot-chat';

/**
 * `/bots/$botId`: a bot's chat. It is the pane (`full`): a header that stays,
 * a transcript that scrolls, and the composer at the foot. The header is the
 * chat's own bar (`bar: 'own'`), the bot's face and menu beside the toggle.
 */
export const Route = createFileRoute('/_authenticated/bots/$botId')({
  staticData: { pane: 'full', bar: 'own' },
  component: BotChatRoute,
});

function BotChatRoute() {
  const { botId } = Route.useParams();
  // Keyed, so moving between two bots starts the chat afresh (its draft included).
  return <BotChatScreen key={botId} botId={botId} />;
}
