import { BotExchange, BotExchangeTurn, TranscriptDivider } from '@oppenheimer/design-system-web';
import { Check, CircleAlert, Repeat, X } from '@oppenheimer/design-system-web/icons';
import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { Trans, useTranslation } from 'react-i18next';
import { OpenSessionButton } from '@/features/bots/components/open-session-button';

/**
 * What Oppenheimer told the bot, in the chat. For you: a trace line (the AI
 * Elements export's decided Confirmation), "You approved: Start Claude Code
 * on build-02…" with a check, a denial in red with a cross, an approved call
 * that failed in red; or a routine that woke it, "Routine · Morning PR
 * digest" (`26-bot-routines.md` §4). From another bot: its message, or its
 * answer to one this bot asked, as a `BotExchange` card naming the bot
 * Oppenheimer recorded as the sender. Read from the event's own fields,
 * never its words, which are the bot's. Never a bubble from you: you did not
 * write it. An approved call that started a session carries Open session on
 * the line.
 */
export function BotEventLine({ message }: { message: BotMessageEntity }) {
  const { t } = useTranslation();
  const { event } = message;
  if (!event) {
    return <TranscriptDivider>{message.content.split('\n')[0]}</TranscriptDivider>;
  }
  if (event.kind === 'routine') {
    return (
      <TranscriptDivider icon={<Repeat />}>
        <span className="max-w-xl truncate" title={event.name}>
          {t('bots.chat.event.routine', { name: event.name })}
        </span>
      </TranscriptDivider>
    );
  }
  if (event.kind !== 'approval') {
    const key =
      event.kind === 'bot_message'
        ? event.expectsReply
          ? 'bots.chat.event.peerAsk'
          : 'bots.chat.event.peerMessage'
        : event.outcome === 'answered'
          ? 'bots.chat.event.peerAnswered'
          : event.outcome === 'failed'
            ? 'bots.chat.event.peerFailed'
            : 'bots.chat.event.peerCancelled';
    return (
      <BotExchange data-message-id={message.id}>
        <BotExchangeTurn
          direction="in"
          reply={event.kind === 'bot_reply'}
          lead={
            <Trans
              i18nKey={key}
              values={{ name: event.fromBotName }}
              components={{ bot: <strong /> }}
            />
          }
        >
          <span className="whitespace-pre-wrap">{message.content}</span>
        </BotExchangeTurn>
      </BotExchange>
    );
  }
  const icon =
    event.outcome === 'approved' ? <Check /> : event.outcome === 'failed' ? <CircleAlert /> : <X />;
  return (
    <TranscriptDivider
      icon={icon}
      tone={event.outcome === 'approved' ? 'default' : 'danger'}
      action={event.sessionId ? <OpenSessionButton sessionId={event.sessionId} /> : undefined}
    >
      <span className="max-w-xl truncate" title={event.summary}>
        {t(`bots.chat.event.${event.outcome}`, { summary: event.summary })}
      </span>
    </TranscriptDivider>
  );
}
