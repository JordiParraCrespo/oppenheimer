import {
  BotExchange,
  BotExchangeTurn,
  ChatNotice,
  TranscriptDivider,
} from '@oppenheimer/design-system-web';
import {
  Ban,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  Hand,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  X,
} from '@oppenheimer/design-system-web/icons';
import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { OpenSessionButton } from '@/features/bots/components/open-session-button';
import { routineEventText, routineNeedsOwner } from '@/features/bots/lib/routine-event';

const ROUTINE_ICONS = {
  ran: <Repeat />,
  saved: <Plus />,
  changed: <Pencil />,
  paused: <Pause />,
  resumed: <Play />,
  deleted: <Trash2 />,
  failed: <CircleAlert />,
} as const;

const SESSION_ICONS = {
  requires_action: <Hand />,
  completed: <CircleCheck />,
  failed: <CircleAlert />,
  cancelled: <Ban />,
  expired: <Clock />,
} as const;

/**
 * What Oppenheimer told the bot, in the chat. For you: a trace line (the AI
 * Elements export's decided Confirmation), "You approved: Start Claude Code
 * on build-02…" with a check, a denial in red with a cross, an approved call
 * that failed in red; an approved call that started a session carries Open
 * session on the line. What became of a routine (`26-bot-routines.md` §4):
 * "Routine · Morning PR digest" where its run opens a turn, "Created routine
 * …" when it is saved, and so on; a run that did not happen, or a pause the
 * owner did not make, is a notice instead, with `action` (Open routines)
 * beside it. From another bot: its message, or its answer to one this bot
 * asked, as a `BotExchange` card naming the bot Oppenheimer recorded as the
 * sender. A session the bot follows that woke it (`27-bot-subscriptions.md`):
 * "Session Research finished" with Open session, in red when it failed. Read from the event's own fields, never its words, which are the
 * bot's. Never a bubble from you: you did not write it.
 */
export function BotEventLine({
  message,
  action,
}: {
  message: BotMessageEntity;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  const { event } = message;
  if (!event) {
    return <TranscriptDivider>{message.content.split('\n')[0]}</TranscriptDivider>;
  }
  if (event.kind === 'routine') {
    const text = routineEventText(event, t);
    if (routineNeedsOwner(event)) {
      return (
        <ChatNotice tone={event.activity === 'failed' ? 'danger' : 'warning'} action={action}>
          {text}
        </ChatNotice>
      );
    }
    return (
      <TranscriptDivider icon={ROUTINE_ICONS[event.activity]}>
        <span className="max-w-xl truncate" title={event.name}>
          {text}
        </span>
      </TranscriptDivider>
    );
  }
  if (event.kind === 'session') {
    return (
      <TranscriptDivider
        icon={SESSION_ICONS[event.state]}
        tone={event.state === 'failed' ? 'danger' : 'default'}
        action={<OpenSessionButton sessionId={event.sessionId} />}
      >
        <span className="max-w-xl truncate" title={event.sessionName}>
          {t(`bots.chat.event.session.${event.state}`, { name: event.sessionName })}
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
