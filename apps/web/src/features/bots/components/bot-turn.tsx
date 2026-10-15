import {
  ChatErrorAction,
  ChatErrorBanner,
  ChatUserMessage,
  IconButton,
  MessageTrail,
} from '@oppenheimer/design-system-web';
import { RotateCcw } from '@oppenheimer/design-system-web/icons';
import { dateFormatter, useLocale } from '@oppenheimer/frontend-web';
import { BOT_PROVIDER_CATALOG, botModelOf } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { BotEventLine } from '@/features/bots/components/bot-event-line';
import { BotReply } from '@/features/bots/components/bot-reply';
import { BotTrace } from '@/features/bots/components/bot-trace';
import { BotTurnLive } from '@/features/bots/components/bot-turn-live';
import { CopyTextButton } from '@/features/bots/components/copy-text-button';
import {
  type ChatTurnBlock,
  compactTokens,
  replyText,
  turnPhase,
} from '@/features/bots/lib/chat-turns';
import { runningStep } from '@/features/bots/lib/tool-activity';

/**
 * One turn of the chat, as the Bots frame draws it (`25-bots.md` §3): your
 * message as a bubble on the right, its time and copy on hover; then the
 * bot's answer unboxed across the column: a quiet trace line per tool call,
 * each opening to what it returned, and what it said, as markdown, the
 * words it is still writing with the write head after them. While it runs,
 * a live line says what it is doing, with its clock. Once it has ended, a
 * trail copies the answer, offers Retry on the newest turn, and says its
 * model and the tokens it took (Stopped first when someone pressed Stop); a
 * failure says why, with Retry beside it.
 */
export function BotTurn({
  block,
  live,
  onRetry,
  retrying = false,
}: {
  block: ChatTurnBlock;
  live: string | undefined;
  /** Sends your last message again; only the newest turn, once it has ended. */
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { turn } = block;
  const time = dateFormatter(locale, { timeStyle: 'short' });
  const phase = turn ? turnPhase(turn, block.answer.length > 0 || Boolean(live)) : null;
  const active = turn?.isActive ?? false;
  const text = replyText(block);
  const tokens = turn ? turn.inputTokens + turn.outputTokens : 0;
  const meta = turn
    ? [
        phase === 'cancelled' ? t('bots.chat.turn.stopped') : null,
        botModelOf(turn.provider, turn.model)?.label ?? turn.model,
        tokens > 0 ? t('bots.chat.tokens', { count: tokens, tokens: compactTokens(tokens) }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <div className="flex flex-col gap-4.5">
      {block.asked.map((message) =>
        message.role === 'event' ? (
          <BotEventLine key={message.id} message={message} />
        ) : (
          <ChatUserMessage
            key={message.id}
            data-message-id={message.id}
            time={time.format(message.createdAt)}
            actions={<CopyTextButton text={message.content} label={t('bots.chat.copyMessage')} />}
          >
            {message.content}
          </ChatUserMessage>
        ),
      )}
      <div data-slot="bot-turn" data-phase={phase ?? undefined} className="flex flex-col gap-3">
        {block.answer.map((message) =>
          message.role === 'activity' ? (
            <BotTrace key={message.id} steps={message.steps} />
          ) : (
            <BotReply key={message.id} content={message.content} />
          ),
        )}
        {live ? <BotReply content={live} streaming /> : null}
        {turn && active ? (
          <BotTurnLive
            queued={turn.status === 'queued'}
            step={runningStep(block.answer)}
            writing={Boolean(live)}
            since={turn.startedAt}
          />
        ) : null}
        {turn && phase === 'failed' ? (
          <ChatErrorBanner
            title={t('bots.chat.failed', { provider: BOT_PROVIDER_CATALOG[turn.provider].label })}
            actions={
              onRetry ? (
                <ChatErrorAction onClick={onRetry} disabled={retrying}>
                  <RotateCcw aria-hidden />
                  {t('bots.chat.retry')}
                </ChatErrorAction>
              ) : undefined
            }
            labels={{ details: t('bots.chat.errorDetails'), less: t('bots.chat.errorLess') }}
          >
            {turn.error ?? t('bots.chat.failedUnknown')}
          </ChatErrorBanner>
        ) : null}
        {turn && !active ? (
          <MessageTrail
            actions={
              <>
                {text ? <CopyTextButton text={text} label={t('bots.chat.copyReply')} /> : null}
                {onRetry && phase !== 'failed' ? (
                  <IconButton
                    size="xs"
                    shape="square"
                    aria-label={t('bots.chat.retry')}
                    title={t('bots.chat.retry')}
                    disabled={retrying}
                    onClick={onRetry}
                  >
                    <RotateCcw aria-hidden />
                  </IconButton>
                ) : null}
              </>
            }
            meta={meta}
          />
        ) : null}
      </div>
    </div>
  );
}
