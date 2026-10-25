import { TranscriptDivider } from '@oppenheimer/design-system-web';
import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import type { BotMessageEvent } from '@oppenheimer/shared/schemas/bot';
import type { ReactNode } from 'react';
import { ApprovalEventLine } from '@/features/bots/components/approval-event-line';
import { PeerEventCard } from '@/features/bots/components/peer-event-card';
import { RoutineEventLine } from '@/features/bots/components/routine-event-line';
import { SessionEventLine } from '@/features/bots/components/session-event-line';

interface EventLineProps<Kind extends BotMessageEvent['kind']> {
  event: Extract<BotMessageEvent, { kind: Kind }>;
  message: BotMessageEntity;
  action?: ReactNode;
}

/**
 * How each kind of event is drawn, one entry per kind, so a new kind is a
 * row here (the compiler asks for it) and a component of its own, not
 * another branch.
 */
const EVENT_LINES: {
  [Kind in BotMessageEvent['kind']]: (props: EventLineProps<Kind>) => ReactNode;
} = {
  approval: ({ event }) => <ApprovalEventLine event={event} />,
  routine: ({ event, action }) => <RoutineEventLine event={event} action={action} />,
  bot_message: ({ event, message }) => (
    <PeerEventCard event={event} messageId={message.id} content={message.content} />
  ),
  bot_reply: ({ event, message }) => (
    <PeerEventCard event={event} messageId={message.id} content={message.content} />
  ),
  session: ({ event }) => <SessionEventLine event={event} />,
};

/**
 * What Oppenheimer told the bot, in the chat, drawn by its kind
 * (`EVENT_LINES`): a decided approval, a routine's activity, another bot's
 * message or answer, a followed session that woke it. Read from the event's
 * own fields, never its words, which are the bot's. Never a bubble from you:
 * you did not write it. An event this client cannot read is its first line.
 */
export function BotEventLine({
  message,
  action,
}: {
  message: BotMessageEntity;
  action?: ReactNode;
}) {
  const { event } = message;
  if (!event) {
    return <TranscriptDivider>{message.content.split('\n')[0]}</TranscriptDivider>;
  }
  const draw = EVENT_LINES[event.kind] as (
    props: EventLineProps<BotMessageEvent['kind']>,
  ) => ReactNode;
  return draw({ event, message, action });
}
