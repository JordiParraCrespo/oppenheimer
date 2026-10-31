import {
  type BotApprovalDecision,
  type BotApprovalReach,
  type BotEventOutcome,
  type BotMessageEvent,
  type BotStreamEvent,
  expandScopes,
  type Scope,
} from '@oppenheimer/shared';
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

/**
 * Where a call that would have asked says why it ran without a card: the
 * data its step keeps for the chat (`BotToolStep.allowedBy`), never the
 * model's words.
 */
export const ALLOWED_BY_DATA_KEY = 'allowedBy';

/** How long a step's `allowedBy` line may be: a rule's words fit with room to spare. */
export const BOT_ALLOWED_BY_MAX = 320;

/** Why a call ran without asking, when a standing grant covered what it acts on. */
export function grantedLine(subjectLabel: string): string {
  return `Always allowed for ${subjectLabel}`;
}

/** What the model reads when its call became a card: nothing ran, and its turn should end. */
export function askedForApproval(summary: string): string {
  return `Not done yet: this needs the person's approval, so it is now waiting on an approval card in the chat ("${summary}"). Nothing has run. End your turn now: say in one sentence what you asked for and that you will carry on once they answer. Do not try to do it another way meanwhile.`;
}

/** What the model reads when an earlier card still waits: one at a time. */
export function waitingForApproval(pendingSummary: string): string {
  return `Not done: an earlier request of yours is still waiting for the person's approval ("${pendingSummary}"), and only one can wait at a time. End your turn now and say you are waiting for their answer.`;
}

/**
 * The decision a request names. The older shape said how far a yes goes in
 * `reach`: `approve` with `tool` meant Always allow, with `subject` Always
 * allow for its subject. A named decision wins over a reach.
 */
export function decisionOf(
  decision: BotApprovalDecision,
  reach: BotApprovalReach,
): BotApprovalDecision {
  if (decision !== 'approve') return decision;
  if (reach === 'tool') return 'approve_always';
  if (reach === 'subject') return 'approve_for_subject';
  return 'approve';
}

/** How far a yes reaches; null for a no. */
export function reachOf(decision: BotApprovalDecision): BotApprovalReach | null {
  switch (decision) {
    case 'approve':
      return 'once';
    case 'approve_for_subject':
      return 'subject';
    case 'approve_always':
      return 'tool';
    default:
      return null;
  }
}

/**
 * A decided approval as the event that opens the bot's next turn. Its first
 * line is what the chat shows ("Ana approved: Start Claude Code on
 * build-02…"); what follows is what the bot needs to report back: the call's
 * answer, or the person's note. `by` is who decided, by name.
 */
export function approvalEvent(approval: BotApprovalEntity, by: string, stopped = false): string {
  const who = by.trim() || 'The person';
  if (approval.status === 'denied') {
    return [
      stopped
        ? `${who} denied and stopped your turn: ${approval.summary}`
        : `${who} denied: ${approval.summary}`,
      approval.note ? `Their note: ${approval.note}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }
  const answer = approval.status === 'failed' ? 'It ran and failed' : 'It ran';
  return `${who} approved: ${approval.summary}\n${answer}: ${approval.result ?? ''}`;
}

/**
 * What the chat draws for a decided approval, without reading the event's
 * words: with the session the approved call started, so the line links to it.
 */
export function approvalEventOf(approval: BotApprovalEntity, stopped = false): BotMessageEvent {
  const outcome: BotEventOutcome =
    approval.status === 'denied'
      ? stopped
        ? 'stopped'
        : 'denied'
      : approval.status === 'failed'
        ? 'failed'
        : 'approved';
  return {
    kind: 'approval',
    outcome,
    tool: approval.tool,
    summary: approval.summary,
    sessionId: approval.sessionId,
    approvalId: approval.id,
  };
}

/**
 * What every open chat hears when a card closes (Codex's
 * `serverRequest/resolved`): which card, how, and its line, so a tab that did
 * not decide takes it down at once and draws the decision before it reads
 * anything again. `expired` when a new message retired it.
 */
export function approvalResolved(
  approval: BotApprovalEntity,
  decision: BotApprovalDecision | 'expired',
): Extract<BotStreamEvent, { type: 'approval_resolved' }> {
  const outcome =
    decision === 'expired'
      ? 'expired'
      : reachOf(decision)
        ? 'approved'
        : decision === 'stop'
          ? 'stopped'
          : 'denied';
  return {
    type: 'approval_resolved',
    approvalId: approval.id,
    outcome,
    tool: approval.tool,
    summary: approval.summary,
  };
}

/**
 * A no that stops the turn, as a line of the chat outside any turn: the bot
 * gets no turn back, but reads the line in its history the next time you
 * write, so it knows what was refused and why.
 */
export function stoppedLine(approval: BotApprovalEntity, by: string): BotMessageEntity {
  return BotMessageEntity.createNew({
    organizationId: approval.organizationId,
    botId: approval.botId,
    turnId: null,
    role: 'event',
    content: approvalEvent(approval, by, true),
    event: approvalEventOf(approval, true),
    steps: [],
    position: 0,
  });
}

/**
 * What two credentials may both do: null is unrestricted (a browser
 * session), so null with a list is the list; two lists meet on what both
 * cover, a write scope covering its read.
 */
export function intersectScopes(
  a: readonly Scope[] | null,
  b: readonly Scope[] | null,
): readonly Scope[] | null {
  if (a === null) return b === null ? null : [...b];
  if (b === null) return [...a];
  const other = expandScopes(b);
  return [...expandScopes(a)].filter((scope) => other.has(scope)).sort();
}

/**
 * The turn a decision gives the bot: queued like a message of yours, on the
 * bot's provider, model and effort as they are now, opened by the event (its
 * words for the bot, what happened for the chat) rather than by words of
 * yours.
 */
export function decisionTurn(
  props: Parameters<typeof BotTurnEntity.queue>[0],
  approval: BotApprovalEntity,
  by: string,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({ ...props, origin: 'approval' });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content: approvalEvent(approval, by),
    event: approvalEventOf(approval),
    steps: [],
    position: 0,
  });
  return { turn, opening };
}
