import { AgentActivity } from '@oppenheimer/design-system-web';
import type { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { useChatActivity } from '../hooks/use-session-chat';

/**
 * What the agent says it is doing this moment, at the foot of the chat, in
 * the words its terminal's spinner uses ("✻ Mustering… (4m 31s · ↓ 15.9k
 * tokens)"): the terminal under the chat reads the line off its grid
 * (`bindAgentActivity`). Subscribed on its own, so the clock beside the word
 * redraws this line and no turn.
 */
export function SessionChatActivity({ chat }: { chat: Chat }) {
  const activity = useChatActivity(chat);
  if (!activity) return null;
  return <AgentActivity verb={activity.verb} detail={activity.detail ?? undefined} />;
}
