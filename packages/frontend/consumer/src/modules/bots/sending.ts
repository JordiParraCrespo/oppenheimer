import type { BotAttachment } from '@oppenheimer/shared/schemas/bot';
import {
  type BotConversationEntity,
  BotMessageEntity,
  BotTurnEntity,
} from './bot-conversation.entity';

/**
 * A message you sent a bot that the API has not answered yet, as the chat
 * draws it: the stored conversation is never changed for it, the chat is
 * drawn with it laid over ({@link withBotSendings}).
 */
export interface BotSending {
  /** Unique to this send: the turn and message drawn for it are named by it. */
  key: string;
  /** Trimmed, as the API stores it. */
  content: string;
  attachments: readonly BotAttachment[];
  steer: boolean;
  at: Date;
  /** The messages the chat held when you sent, so a read that holds the stored one is told apart. */
  seen: ReadonlySet<string>;
}

const SENDING = 'sending:';

/** A turn drawn for a send the API has not answered: it has no id there, so Stop and Edit wait. */
export function isSendingBotTurn(turnId: string): boolean {
  return turnId.startsWith(SENDING);
}

/**
 * The conversation with each send still answering laid over it, oldest
 * first: your message, and its turn queued on the model the newest turn ran
 * on, so it is drawn the moment you send (behind a running turn, among the
 * waiting messages; else in the transcript, working). A send the read
 * already holds is left as read: the API has stored a message of yours with
 * its words that the chat did not hold when you sent.
 */
export function withBotSendings(
  conversation: BotConversationEntity,
  sendings: readonly BotSending[],
): BotConversationEntity {
  const drawn = sendings.filter((sending) => !holdsSent(conversation, sending));
  if (drawn.length === 0) return conversation;
  const newest = conversation.turns.at(-1);
  const turns = drawn.map(
    (sending) =>
      new BotTurnEntity(
        `${SENDING}${sending.key}`,
        'queued',
        newest?.provider ?? 'anthropic',
        newest?.model ?? '',
        null,
        0,
        0,
        false,
        sending.at,
        null,
        null,
        null,
        null,
        null,
        sending.steer,
      ),
  );
  const messages = drawn.map(
    (sending) =>
      new BotMessageEntity(
        `${SENDING}${sending.key}`,
        `${SENDING}${sending.key}`,
        'user',
        sending.content,
        [],
        sending.at,
        null,
        sending.attachments,
      ),
  );
  return conversation.withLines(
    [...conversation.messages, ...messages],
    [...conversation.turns, ...turns],
    conversation.messageCount + drawn.length,
  );
}

function holdsSent(conversation: BotConversationEntity, sending: BotSending): boolean {
  return conversation.messages.some(
    (message) =>
      message.role === 'user' &&
      message.content === sending.content &&
      !isSendingBotTurn(message.id) &&
      !sending.seen.has(message.id),
  );
}
