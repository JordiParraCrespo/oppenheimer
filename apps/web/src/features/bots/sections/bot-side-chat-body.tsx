import { useSuspenseBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useToolCallsShown } from '@/features/bots/hooks/use-tool-calls-shown';
import { BotChatBody } from './bot-chat-body';

/**
 * A bot's conversation in a session's side pane, once the bot has answered.
 * The pane's tab names the bot and links to its page, so there is no head:
 * tool calls show as this device last chose on the bot's own page. A drop
 * on the session beside it stays the session's.
 */
export function BotSideChatBody({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: bot, error } = useSuspenseBot(botId);
  const toolCalls = useToolCallsShown();

  return (
    <BotChatBody bot={bot} toolCallsShown={toolCalls.shown} dropsOn="box">
      <ErrorAlert error={error} fallback={t('bots.chat.loadFailed')} className="mb-4" />
    </BotChatBody>
  );
}
