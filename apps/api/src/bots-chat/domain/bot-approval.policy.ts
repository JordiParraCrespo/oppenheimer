import type { BotApprovalEntity } from './bot-approval.entity';
import { BotMessageEntity } from './bot-message.entity';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * The words around a Needs input card (`25-bots.md` §5): what an asking
 * tool answers the model when it asks instead of running, and the event that
 * opens the turn after the owner decides. The event is one text for two
 * readers: the chat draws it as a small line, and the bot reads it as a note
 * from Oppenheimer (`botEventPrompt`).
 */

/** What the model reads when its call became a card: nothing ran, and its turn should end. */
export function askedForApproval(summary: string): string {
  return `Not done yet: this needs the person's approval, so it is now waiting on an approval card in the chat ("${summary}"). Nothing has run. End your turn now: say in one sentence what you asked for and that you will carry on once they answer. Do not try to do it another way meanwhile.`;
}

/** What the model reads when an earlier card still waits: one at a time. */
export function waitingForApproval(pendingSummary: string): string {
  return `Not done: an earlier request of yours is still waiting for the person's approval ("${pendingSummary}"), and only one can wait at a time. End your turn now and say you are waiting for their answer.`;
}

/**
 * A decided approval as the event that opens the bot's next turn. Its first
 * line is what the chat shows ("Ana approved: Start Claude Code on
 * build-02…"); what follows is what the bot needs to report back: the call's
 * answer, or the person's note. `by` is who decided, by name.
 */
export function approvalEvent(approval: BotApprovalEntity, by: string): string {
  const who = by.trim() || 'The person';
  if (approval.status === 'denied') {
    return [
      `${who} denied: ${approval.summary}`,
      approval.note ? `Their note: ${approval.note}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }
  const answer = approval.status === 'failed' ? 'It ran and failed' : 'It ran';
  return `${who} approved: ${approval.summary}\n${answer}: ${approval.result ?? ''}`;
}

/**
 * The turn a decision gives the bot: queued like a message of yours, on the
 * bot's provider, model and effort as they are now, and opened by the event
 * rather than by words of yours.
 */
export function decisionTurn(
  props: Parameters<typeof BotTurnEntity.queue>[0],
  event: string,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue(props);
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content: event,
    steps: [],
    position: 0,
  });
  return { turn, opening };
}
