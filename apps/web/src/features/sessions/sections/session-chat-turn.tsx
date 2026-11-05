import type { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { ChatTurn } from '../components/chat-turn';
import { useChatTurn } from '../hooks/use-session-chat';

/**
 * One turn of a session's chat, subscribed to that turn alone: a line the
 * agent writes redraws the turn it lands in, never the forty above it.
 */
export function SessionChatTurn({ chat, id }: { chat: Chat; id: string }) {
  const turn = useChatTurn(chat, id);
  return turn ? <ChatTurn turn={turn} /> : null;
}
