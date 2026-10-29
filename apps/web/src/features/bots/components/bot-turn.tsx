import { ChatUserMessage, IconButton, MessageTrail } from '@oppenheimer/design-system-web';
import { RotateCcw } from '@oppenheimer/design-system-web/icons';
import { dateFormatter, formatTimeAway, useLocale } from '@oppenheimer/frontend-web';
import {
  BOT_PROVIDER_CATALOG,
  type BotAttachment,
  type BotSubagentProgress,
  botModelOf,
} from '@oppenheimer/shared/schemas/bot';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BotEventLine } from '@/features/bots/components/bot-event-line';
import { BotReply } from '@/features/bots/components/bot-reply';
import { BotTrace } from '@/features/bots/components/bot-trace';
import { BotTurnFailure } from '@/features/bots/components/bot-turn-failure';
import { BotTurnLive } from '@/features/bots/components/bot-turn-live';
import { CopyTextButton } from '@/features/bots/components/copy-text-button';
import {
  type ChatTurnBlock,
  compactTokens,
  replyText,
  turnDurationMs,
  turnPhase,
} from '@/features/bots/lib/chat-turns';
import { runningStep } from '@/features/bots/lib/tool-activity';

/**
 * One turn of the chat, as the Bots frame draws it (`25-bots.md` §3): your
 * message as a bubble on the right, its time and copy on hover; then the
 * bot's answer unboxed across the column: a quiet trace line per tool call,
 * each opening to what it returned, and what it said, as markdown, the
 * words it is still writing with the write head after them. While it runs,
 * a live line says what it is doing, with its clock, and the subagents a
 * running `delegate` call has at work under it. Once it has ended, a
 * trail copies the answer, offers Retry on the newest turn, and says how
 * long it worked, its model and the tokens it took (Stopped first when
 * someone pressed Stop); a failure says why and what helps
 * (`BotTurnFailure`). The images your message carried
 * sit above its bubble, and the ones the bot showed (`show_image`) in its
 * answer where it showed them, both drawn by `images`, which reads them.
 */
export function BotTurn({
  block,
  live,
  waitingOn,
  subagents,
  images,
  onRetry,
  retrying = false,
  onOpenProviders,
}: {
  block: ChatTurnBlock;
  live: string | undefined;
  /** Why the running turn waits to try a refused call again; none while it does not. */
  waitingOn?: 'rate_limit' | 'unavailable';
  /** Where each running `delegate` call's children are, by the call's id. */
  subagents: Readonly<Record<string, readonly BotSubagentProgress[]>>;
  /** The images a message carried, yours or the bot's, as the section that reads them draws them. */
  images: (attachments: readonly BotAttachment[]) => ReactNode;
  /** Sends your last message again; only the newest turn, once it has ended. */
  onRetry?: () => void;
  retrying?: boolean;
  /** Opens Settings → Model providers, where a refused key or sign-in is fixed. */
  onOpenProviders?: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { turn } = block;
  const time = dateFormatter(locale, { timeStyle: 'short' });
  const phase = turn ? turnPhase(turn, block.answer.length > 0 || Boolean(live)) : null;
  const active = turn?.isActive ?? false;
  const text = replyText(block);
  const step = active ? runningStep(block.answer) : undefined;
  const tokens = turn ? turn.inputTokens + turn.outputTokens : 0;
  const ran = turn ? turnDurationMs(turn) : null;
  const meta = turn
    ? [
        phase === 'cancelled' ? t('bots.chat.turn.stopped') : null,
        ran !== null ? t('bots.chat.workedFor', { time: formatTimeAway(ran, locale) }) : null,
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
            actions={
              message.content ? (
                <CopyTextButton text={message.content} label={t('bots.chat.copyMessage')} />
              ) : undefined
            }
            attachments={message.attachments.length > 0 ? images(message.attachments) : undefined}
          >
            {message.content || null}
          </ChatUserMessage>
        ),
      )}
      <div data-slot="bot-turn" data-phase={phase ?? undefined} className="flex flex-col gap-3">
        {block.answer.map((message) =>
          message.role === 'activity' ? (
            <BotTrace key={message.id} steps={message.steps} />
          ) : message.attachments.length > 0 ? (
            <div key={message.id} className="flex flex-col gap-3">
              {message.content ? <BotReply content={message.content} /> : null}
              <div className="flex flex-wrap gap-1.5">{images(message.attachments)}</div>
            </div>
          ) : (
            <BotReply key={message.id} content={message.content} />
          ),
        )}
        {live ? <BotReply content={live} streaming /> : null}
        {turn && active ? (
          <BotTurnLive
            queued={turn.status === 'queued'}
            step={step}
            subagents={step ? subagents[step.callId] : undefined}
            writing={Boolean(live)}
            waitingOn={waitingOn}
            provider={BOT_PROVIDER_CATALOG[turn.provider].label}
            since={turn.startedAt}
          />
        ) : null}
        {turn && phase === 'failed' ? (
          <BotTurnFailure
            turn={turn}
            onRetry={onRetry}
            retrying={retrying}
            onOpenProviders={onOpenProviders}
          />
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
