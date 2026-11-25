import { type BotTurnOrigin, isChannelOrigin } from '@oppenheimer/shared';

/**
 * What a turn's end owes beyond the turn itself, decided from the turn alone:
 * its answer sent back to the channel chat it was asked in, posted on the
 * GitHub thread it was asked on, or queued on the bot that asked it. Pure; the
 * repository stages one job per delivery in the transaction that ends the
 * turn, so a new place a turn answers is one more case here and one more row
 * there. What depends on other rows (a loop's run, a goal) is decided beside
 * the write, which reads them.
 */
export const TURN_END_DELIVERIES = ['channel_reply', 'github_answer', 'bot_answer'] as const;
export type TurnEndDelivery = (typeof TURN_END_DELIVERIES)[number];

export function turnEndDeliveries(turn: {
  origin: BotTurnOrigin;
  replyRequested: boolean;
  askedByTurnId: string | null;
}): TurnEndDelivery[] {
  const owed: TurnEndDelivery[] = [];
  if (isChannelOrigin(turn.origin)) owed.push('channel_reply');
  if (turn.origin === 'github') owed.push('github_answer');
  if (turn.replyRequested && turn.askedByTurnId) owed.push('bot_answer');
  return owed;
}
