import {
  ChatErrorAction,
  ChatErrorBanner,
  ChatUserMessage,
  MessageTrail,
} from '@oppenheimer/design-system-web';
import { RotateCcw } from '@oppenheimer/design-system-web/icons';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { dateFormatter, formatElapsed, useLocale } from '@oppenheimer/frontend-web';
import { BOT_PROVIDER_CATALOG, botModelOf } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { BotActivity } from '@/features/bots/components/bot-activity';
import { BotReply } from '@/features/bots/components/bot-reply';
import { BotTurnByline } from '@/features/bots/components/bot-turn-byline';
import { CopyTextButton } from '@/features/bots/components/copy-text-button';
import {
  type ChatTurnBlock,
  replyText,
  turnDurationMs,
  turnPhase,
} from '@/features/bots/lib/chat-turns';

/**
 * One turn of the chat (`25-bots.md` §3): your message as a bubble on the
 * right, its time and a copy button on hover; then the bot's answer across
 * the column under its face and name: what it did, a quiet line per run of
 * tool calls, and what it said, as markdown, the words it is still writing
 * with the write head after them. Before the first word the byline says it
 * is thinking. Once it has ended, a trail under it copies the answer and
 * says how it went (its model, how long it took, Stopped when someone
 * pressed Stop); a failure says why, with Retry on the newest turn.
 */
export function BotTurn({
  block,
  bot,
  live,
  onRetry,
  retrying = false,
}: {
  block: ChatTurnBlock;
  bot: Pick<BotEntity, 'name' | 'initials' | 'avatarColor'>;
  live: string | undefined;
  /** Sends your last message again; only the newest turn, when it failed. */
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { turn } = block;
  const time = dateFormatter(locale, { timeStyle: 'short' });
  const phase = turn ? turnPhase(turn, block.answer.length > 0 || Boolean(live)) : null;
  const settled = phase === 'completed' || phase === 'cancelled' || phase === 'failed';
  const text = replyText(block);
  const duration = turn ? turnDurationMs(turn) : null;
  const meta = turn
    ? [
        phase === 'cancelled' ? t('bots.chat.turn.stopped') : null,
        botModelOf(turn.provider, turn.model)?.label ?? turn.model,
        duration === null ? null : formatElapsed(duration),
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <div className="flex flex-col gap-4 not-first:pt-4">
      {block.asked.map((message) => (
        <ChatUserMessage
          key={message.id}
          actions={
            <>
              <span className="figures pr-1 font-mono text-micro">
                {time.format(message.createdAt)}
              </span>
              <CopyTextButton text={message.content} label={t('bots.chat.copyMessage')} />
            </>
          }
        >
          <span className="whitespace-pre-wrap">{message.content}</span>
        </ChatUserMessage>
      ))}
      <div
        data-slot="bot-turn"
        data-phase={phase ?? undefined}
        className="group/reply flex flex-col gap-3"
      >
        <BotTurnByline
          name={bot.name}
          initials={bot.initials}
          color={bot.avatarColor}
          phase={phase}
          since={turn?.startedAt ?? null}
          time={settled && turn?.endedAt ? time.format(turn.endedAt) : undefined}
        />
        {block.answer.map((message) =>
          message.role === 'activity' ? (
            <BotActivity key={message.id} steps={message.steps} />
          ) : (
            <BotReply key={message.id} content={message.content} />
          ),
        )}
        {live ? <BotReply content={live} streaming /> : null}
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
        {settled ? (
          <MessageTrail
            actions={
              text ? <CopyTextButton text={text} label={t('bots.chat.copyReply')} /> : undefined
            }
            meta={meta}
          />
        ) : null}
      </div>
    </div>
  );
}
