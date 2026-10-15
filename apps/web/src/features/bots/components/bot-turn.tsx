import { ChatErrorBanner, ChatUserMessage } from '@oppenheimer/design-system-web';
import { dateFormatter, useLocale } from '@oppenheimer/frontend-web';
import { BOT_PROVIDER_CATALOG, botModelOf } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { BotActivity } from '@/features/bots/components/bot-activity';
import { BotEventLine } from '@/features/bots/components/bot-event-line';
import { BotReply } from '@/features/bots/components/bot-reply';
import { BotTurnHeader } from '@/features/bots/components/bot-turn-header';
import type { ChatTurnBlock } from '@/features/bots/lib/chat-turns';

/**
 * One turn of the chat (`25-bots.md` §3): your message as a card on the
 * right, then the turn's header, then what the bot did in the order it did
 * it (its replies, a folded line per run of tool calls), the text it is still
 * writing with the write head after it, and why it failed when it did.
 */
export function BotTurn({ block, live }: { block: ChatTurnBlock; live: string | undefined }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { turn } = block;
  const time = dateFormatter(locale, { timeStyle: 'short' });
  return (
    <div className="flex flex-col gap-4">
      {block.asked.map((message) =>
        message.role === 'event' ? (
          <BotEventLine key={message.id} content={message.content} />
        ) : (
          <ChatUserMessage key={message.id} time={time.format(message.createdAt)}>
            <span className="whitespace-pre-wrap">{message.content}</span>
          </ChatUserMessage>
        ),
      )}
      {turn ? (
        <BotTurnHeader
          turn={turn}
          modelLabel={botModelOf(turn.provider, turn.model)?.label ?? turn.model}
        />
      ) : null}
      {block.answer.map((message) =>
        message.role === 'activity' ? (
          <BotActivity key={message.id} steps={message.steps} />
        ) : (
          <BotReply key={message.id} content={message.content} />
        ),
      )}
      {live ? <BotReply content={live} streaming /> : null}
      {turn?.status === 'failed' ? (
        <ChatErrorBanner
          title={t('bots.chat.failed', { provider: BOT_PROVIDER_CATALOG[turn.provider].label })}
          labels={{
            details: t('bots.chat.errorDetails'),
            less: t('bots.chat.errorLess'),
          }}
        >
          {turn.error ?? t('bots.chat.failedUnknown')}
        </ChatErrorBanner>
      ) : null}
    </div>
  );
}
