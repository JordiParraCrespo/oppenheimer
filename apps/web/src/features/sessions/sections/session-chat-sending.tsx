import { ChatUserMessage } from '@oppenheimer/design-system-web';
import type { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { useChatSending } from '../hooks/use-session-chat';

/**
 * What the reader sent that the agent's transcript has not shown yet, at the
 * chat's end, each a faded card where its turn will open: the agent writes a
 * prompt down only once it takes it, and the host sends the line on after,
 * so without these a message sent showed nothing for seconds. The turn's own
 * card replaces each one as it comes (`SessionChat.post`).
 */
export function SessionChatSending({ chat }: { chat: Chat }) {
  const { t } = useTranslation();
  const sending = useChatSending(chat);
  // Faded around the card: its rise ends at full opacity, holding its last frame.
  return sending.map((sent) => (
    <div key={sent.id} className="opacity-60">
      <ChatUserMessage
        tone="wash"
        aria-busy
        className="motion-safe:animate-appear"
        time={t('sessions.chat.sending')}
      >
        {sent.text}
      </ChatUserMessage>
    </div>
  ));
}
