import { ChatTranscript } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import {
  useBotLiveText,
  useSendBotMessage,
  useSuspenseBotConversation,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotTurn } from '@/features/bots/components/bot-turn';
import { chatTurns, retryContent } from '@/features/bots/lib/chat-turns';
import { BotHello } from './bot-hello';

/**
 * The chat itself (`25-bots.md` §3): every turn as you sent it and as the bot
 * answered, live while one runs. Before the first message, the bot's hello.
 * It keeps the bot's stream open while it is on screen, so text arrives as
 * the bot writes it and each stored message the moment it lands. When the
 * newest turn failed, Retry sends your last message again.
 */
export function BotTranscript({
  bot,
}: {
  bot: Pick<BotEntity, 'id' | 'name' | 'initials' | 'avatarColor'>;
}) {
  const { t } = useTranslation();
  const { data: conversation, error } = useSuspenseBotConversation(bot.id);
  const live = useBotLiveText(bot.id);
  const retry = useSendBotMessage();
  const blocks = chatTurns(conversation);
  const again = retryContent(blocks);
  const newest = blocks.at(-1)?.turnId;

  return (
    <>
      <ErrorAlert error={error} fallback={t('bots.chat.loadFailed')} className="mb-4" />
      {blocks.length === 0 ? (
        <BotHello botId={bot.id} name={bot.name} initials={bot.initials} color={bot.avatarColor} />
      ) : (
        <ChatTranscript>
          {blocks.map((block) => (
            <BotTurn
              key={block.turnId}
              block={block}
              bot={bot}
              live={live[block.turnId]}
              onRetry={
                again !== null && block.turnId === newest
                  ? () => retry.mutate({ id: bot.id, content: again })
                  : undefined
              }
              retrying={retry.isPending}
            />
          ))}
          <ErrorAlert
            error={retry.error}
            fallback={t('bots.chat.sendFailed')}
            onDismiss={() => retry.reset()}
          />
        </ChatTranscript>
      )}
    </>
  );
}
