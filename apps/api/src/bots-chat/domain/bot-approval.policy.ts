import {
  type BotApprovalDecision,
  type BotApprovalEvent,
  type BotApprovalEventStage,
  type BotApprovalReach,
  type BotApprovalResolution,
  type BotEventOutcome,
  type BotMessageEvent,
  type BotStreamEvent,
  expandScopes,
  type Scope,
} from '@oppenheimer/shared';
import type { BotApprovalEntity } from './bot-approval.entity';
import { BotMessageEntity } from './bot-message.entity';
import { promptText } from './bot-prompt-text.policy';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * The words around a Needs input card: what an asking
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
  return promptText('tools/approval.asked-for-approval', { summary });
}

/** What the model reads when an earlier card still waits: one at a time. */
export function waitingForApproval(pendingSummary: string): string {
  return promptText('tools/approval.waiting-for-approval', { pendingSummary });
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
 * The words that open the turn a yes gives the bot at once: who approved what,
 * and that it runs now. The chat draws its fields;
 * the bot reads this and says it is on it (`approvalAsk`).
 */
export function approvalStartedWords(approval: BotApprovalEntity, by: string): string {
  return promptText('wake/approval.started', { who: who(by), summary: approval.summary });
}

/** The words that open the turn reporting an approved call: what it was, and its answer. */
export function approvalFinishedWords(approval: BotApprovalEntity, by: string): string {
  return promptText('wake/approval.finished', {
    who: who(by),
    summary: approval.summary,
    answer: promptText(
      approval.status === 'failed' ? 'wake/approval.it-ran-and-failed' : 'wake/approval.it-ran',
    ),
    result: approval.result ?? '',
  });
}

/** The words that open the turn a no gives the bot: what was refused, and the note. */
export function deniedWords(approval: BotApprovalEntity, by: string): string {
  return denialWords(approval, 'wake/approval.denied', by);
}

/**
 * What the bot is asked to do with an approval's turn, by the line that
 * opened it: say it is on it while the call runs (`started`), or report what
 * came of the card (how the call went, or the no).
 */
export function approvalAsk(stage: BotApprovalEventStage | undefined): string {
  return promptText(
    stage === 'started' ? 'wake/approval.ask-started' : 'wake/approval.ask-decided',
  );
}

/**
 * The approval a turn's opening says was approved and is running: the turn
 * a yes opens at once, where the bot only says it is on it. Null for any
 * other opening.
 */
export function approvalStartedBy(
  opening: { role: string; event?: BotMessageEvent | null } | null,
): string | null {
  const event = opening?.role === 'event' ? opening.event : null;
  return event?.kind === 'approval' && event.stage === 'started'
    ? (event.approvalId ?? null)
    : null;
}

/** Who decided, by name, as the bot is told; "The person" when the name is unknown. */
function who(by: string): string {
  return by.trim() || promptText('wake/approval.the-person');
}

/** A no in words: what was refused, then the person's note when they added one. */
function denialWords(
  approval: BotApprovalEntity,
  lead: 'wake/approval.denied' | 'wake/approval.denied-and-stopped',
  by: string,
): string {
  return [
    promptText(lead, { who: who(by), summary: approval.summary }),
    approval.note ? promptText('wake/approval.their-note', { note: approval.note }) : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** How a decided approval's line reads, by the status it ended in. */
const EVENT_OUTCOMES: Partial<Record<BotApprovalEntity['status'], BotEventOutcome>> = {
  denied: 'denied',
  failed: 'failed',
};

/**
 * What the chat draws for a decided approval, without reading the event's
 * words: with the session the approved call started, so the line links to it.
 */
export function approvalEventOf(approval: BotApprovalEntity): BotApprovalEvent {
  return {
    kind: 'approval',
    outcome: EVENT_OUTCOMES[approval.status] ?? 'approved',
    tool: approval.tool,
    summary: approval.summary,
    sessionId: approval.sessionId,
    approvalId: approval.id,
  };
}

/** How a card closed, by the decision that closed it. */
const RESOLUTIONS: Record<BotApprovalDecision | 'expired', BotApprovalResolution> = {
  approve: 'approved',
  approve_for_subject: 'approved',
  approve_always: 'approved',
  deny: 'denied',
  stop: 'stopped',
  expired: 'expired',
};

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
  return {
    type: 'approval_resolved',
    approvalId: approval.id,
    outcome: RESOLUTIONS[decision],
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
    content: denialWords(approval, 'wake/approval.denied-and-stopped', by),
    event: { ...approvalEventOf(approval), outcome: 'stopped' },
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

type TurnProps = Parameters<typeof BotTurnEntity.queue>[0];

/**
 * The turns a decision gives the bot, each queued like a
 * message of yours, on the bot's provider, model and effort as they are now,
 * and opened by an event (its words for the bot, its fields for the chat)
 * rather than by words of yours. A yes gives two: one at once, where the bot
 * says it is on it while the call runs, and one when the call ran, where it
 * reports how it went. A no gives one.
 */
export function approvalStartedTurn(props: TurnProps, approval: BotApprovalEntity, by: string) {
  return eventTurn(props, approvalStartedWords(approval, by), {
    ...approvalEventOf(approval),
    stage: 'started',
  });
}

/** The turn that reports how an approved call went, once it ran. */
export function approvalFinishedTurn(props: TurnProps, approval: BotApprovalEntity, by: string) {
  return eventTurn(props, approvalFinishedWords(approval, by), {
    ...approvalEventOf(approval),
    stage: 'finished',
  });
}

/** The turn that tells the bot it was denied, so it carries on. */
export function deniedTurn(props: TurnProps, approval: BotApprovalEntity, by: string) {
  return eventTurn(props, deniedWords(approval, by), approvalEventOf(approval));
}

function eventTurn(
  props: TurnProps,
  content: string,
  event: BotApprovalEvent,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({ ...props, origin: 'approval' });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content,
    event,
    steps: [],
    position: 0,
  });
  return { turn, opening };
}
