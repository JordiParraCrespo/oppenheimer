import type { BotAttachment } from '@oppenheimer/shared/schemas/bot';

/**
 * A message you sent a bot, as the chat draws it before the API has
 * answered (`BotConversationEntity.withSending`).
 */
export interface BotSending {
  /** Unique to this send: the turn and message drawn for it are named by it. */
  key: string;
  content: string;
  attachments: readonly BotAttachment[];
  steer: boolean;
  at: Date;
}

const SENDING = 'sending:';

/** The id the turn and message drawn for a send carry until the API names them. */
export function sendingTurnId(key: string): string {
  return `${SENDING}${key}`;
}

/** A turn drawn for a send the API has not answered: it has no id there, so Stop and Edit wait. */
export function isSendingBotTurn(turnId: string): boolean {
  return turnId.startsWith(SENDING);
}
