import { ChatTranscript } from '@oppenheimer/design-system-web';
import { useBotLiveText, useSuspenseBotConversation } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotTurn } from '@/features/bots/components/bot-turn';
import { chatTurns } from '@/features/bots/lib/chat-turns';
import { BotHello } from './bot-hello';

/**
 * The chat itself (`25-bots.md` §3): every turn as you sent it and as the bot
 * answered, live while one runs. Before the first message, the bot's hello.
 * It keeps the bot's stream open while it is on screen, so text arrives as
 * the bot writes it and each stored message the moment it lands.
 */
export function BotTranscript({
  botId,
  name,
  modelLabel,
}: {
  botId: string;
  name: string;
  modelLabel: string | null;
}) {
  const { t } = useTranslation();
  const { data: conversation, error } = useSuspenseBotConversation(botId);
  const live = useBotLiveText(botId);
  const blocks = chatTurns(conversation);

  return (
    <>
      <ErrorAlert error={error} fallback={t('bots.chat.loadFailed')} className="mb-4" />
      {blocks.length === 0 ? (
        <BotHello botId={botId} name={name} modelLabel={modelLabel} />
      ) : (
        <ChatTranscript>
          {blocks.map((block) => (
            <BotTurn key={block.turnId} block={block} live={live[block.turnId]} />
          ))}
        </ChatTranscript>
      )}
    </>
  );
}
