import { ChatMarker, ChatUserMessage } from '@oppenheimer/design-system-web';
import { CornerDownRight } from '@oppenheimer/design-system-web/icons';
import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { CopyTextButton } from '@/features/bots/components/copy-text-button';

/**
 * A message you steered into a turn while the bot worked, where the bot
 * took it: after the tool call whose result carried it, inside the bot's
 * answer, your bubble under a quiet line that says it went in mid-turn.
 */
export function BotSteerMessage({ message, time }: { message: BotMessageEntity; time: string }) {
  const { t } = useTranslation();
  return (
    <div data-slot="bot-steer" className="flex flex-col items-end">
      <ChatMarker icon={<CornerDownRight aria-hidden />}>{t('bots.chat.steered')}</ChatMarker>
      <ChatUserMessage
        data-message-id={message.id}
        className="w-full"
        time={time}
        actions={<CopyTextButton text={message.content} label={t('bots.chat.copyMessage')} />}
      >
        {message.content}
      </ChatUserMessage>
    </div>
  );
}
