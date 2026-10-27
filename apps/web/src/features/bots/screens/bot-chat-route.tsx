import { useParams } from '@tanstack/react-router';
import { BotChatScreen } from './bot-chat';

/**
 * A bot's chat as the page of a `…/bots/$botId` route, wherever it is mounted:
 * inside a section (`28-bots-in-sections.md`) or in Employees. It reads the
 * bot from the address and keys the screen by it, so moving between two bots
 * starts the chat afresh, its draft included. The route declares the pane
 * (`full`, with its own bar); this owns what fills it.
 */
export function BotChatRoute() {
  const { botId } = useParams({ strict: false });
  return botId ? <BotChatScreen key={botId} botId={botId} /> : null;
}
