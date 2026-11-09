import {
  BOT_GOAL_IDLE_TURNS,
  type BotGoalActivity,
  type BotGoalPauseReason,
  type BotTurnFailure,
  type BotTurnStatus,
  botGoalCommandOf,
  parseBotSlashCommand,
  type Scope,
} from '@oppenheimer/shared';
import { BotGoalEntity, goalKeyPrefix } from './bot-goal.entity';
import type { BotGoalVerdict } from './bot-goal-review.policy';
import { BotMessageEntity } from './bot-message.entity';
import { BotTurnEntity, isTurnLimitFailure } from './bot-turn.entity';

/**
 * A goal keeps a bot going (`25-bots.md` §4.1; from Codex's and Grok Bot's
 * goals, `research/lessons-from-long-running-agents.md`). When a turn of the
 * goal ends, the next is queued, keyed by the goal and its number, so an end
 * delivered twice queues one; with no limit of continuations since
 * 2026-11-09. The bot says when it is done (`end_goal`) and a reviewer checks
 * the claim (`bot-goal-review.policy.ts`). What stops a goal that goes wrong
 * is a pause, from Codex: its turns failing, stopping, calling no tool
 * `BOT_GOAL_IDLE_TURNS` times in a row, or spending its budget. A person's
 * message, a routine or a wake may run in between: the continuation waits its
 * lane, and only the goal's own turns move it on.
 */

/** The key of a goal's `step`th continuation turn. */
export function goalSourceKey(goalId: string, step: number): string {
  return `${goalKeyPrefix(goalId)}${step}`;
}

export { GOAL_KEY_PREFIX, goalKeyPrefix } from './bot-goal.entity';

/** The turn that ended, as the decision reads it. */
export interface EndedTurn {
  id: string;
  sourceKey: string | null;
  status: BotTurnStatus;
  /** Why it failed; null unless it did. */
  failure: BotTurnFailure | null;
  /** The failure's words; null unless it failed. */
  error: string | null;
}

/** The turn a person's message queued, as the goal it sets keeps it. */
export interface GoalSettingTurn {
  organizationId: string;
  botId: string;
  id: string;
  credentialScopes: readonly Scope[] | null;
  timeZone: string | null;
}

/**
 * The goal a person's message sets (`25-bots.md` §4.1, "Built-in
 * commands"): `/goal <condition>` sets one on the turn it queues, with no
 * budget; null for any other message, `/goal` alone and
 * `/goal clear` included, which `refuseConsoleCommand`
 * (`bot-built-in.policy.ts`) refuses first.
 */
export function goalFromMessage(content: string, turn: GoalSettingTurn): BotGoalEntity | null {
  const command = botGoalCommandOf(parseBotSlashCommand(content));
  if (command?.kind !== 'set') return null;
  return BotGoalEntity.set({
    organizationId: turn.organizationId,
    botId: turn.botId,
    originTurnId: turn.id,
    objective: command.condition,
    tokenBudget: null,
    credentialScopes: turn.credentialScopes,
    timeZone: turn.timeZone,
  });
}

/** What the end of a turn of the goal means for it, before the reviewer is asked. */
export type GoalDecision =
  | { kind: 'skip' }
  | { kind: 'continue' }
  | { kind: 'review' }
  | { kind: 'pause'; reason: BotGoalPauseReason; note: string | null }
  | { kind: 'end'; activity: 'exhausted'; reason: null };

/** How a goal ends, as its line says it. */
export interface GoalEnding {
  activity: Exclude<BotGoalActivity, 'continued' | 'paused' | 'resumed'>;
  reason: string | null;
}

/**
 * What the goal does once the reviewer has answered the bot's claim:
 * end, pause, or queue its next continuation as `props` say (the owner, the
 * engine, the reach), with the reviewer's reason.
 */
export type GoalOutcome<Props> =
  | { kind: 'continue'; props: Props; reason: string | null }
  | { kind: 'pause'; reason: BotGoalPauseReason; note: string | null }
  | ({ kind: 'end' } & GoalEnding);

/**
 * Whether a turn is one of the goal's: the turn that set it, or one of its
 * continuations. Only their ends move a goal: a goal always has exactly one
 * of them queued, running or just ended, so another turn's end has nothing
 * to add.
 */
export function isGoalTurn(
  goal: Pick<BotGoalEntity, 'id' | 'originTurnId'>,
  turn: Pick<EndedTurn, 'id' | 'sourceKey'>,
): boolean {
  return (
    turn.id === goal.originTurnId || Boolean(turn.sourceKey?.startsWith(goalKeyPrefix(goal.id)))
  );
}

/**
 * Which of the goal's turns this is: 0 for the turn that set it, `n` for its
 * nth continuation (the number its key carries).
 */
function goalStepOf(goal: Pick<BotGoalEntity, 'id'>, turn: Pick<EndedTurn, 'sourceKey'>): number {
  const prefix = goalKeyPrefix(goal.id);
  if (!turn.sourceKey?.startsWith(prefix)) return 0;
  const step = Number(turn.sourceKey.slice(prefix.length));
  return Number.isInteger(step) && step > 0 ? step : 0;
}

/**
 * Whether the end of one of the goal's turns was already decided: the goal
 * has counted a later continuation than the turn is, so the decision ran and
 * moved it on. A job for the same end run again (a worker that died
 * mid-job, a redelivery) then changes nothing: it would count the turn's
 * spend twice and queue a continuation beside the one already queued.
 */
export function isDecidedTurn(
  goal: Pick<BotGoalEntity, 'id' | 'continuations'>,
  turn: Pick<EndedTurn, 'sourceKey'>,
): boolean {
  return goal.continuations > goalStepOf(goal, turn);
}

/**
 * Why a failed turn pauses its goal, by the turn's failure: the provider's
 * limit, quota or sign-in waits until it is sorted (`usage_limit`), the loop
 * guard's stop needs the person (`blocked`), and any other failure is
 * `failed`. A new failure that pauses differently is a row here.
 */
const FAILURE_PAUSES: Partial<Record<BotTurnFailure, BotGoalPauseReason>> = {
  rate_limit: 'usage_limit',
  usage_limit: 'usage_limit',
  credential: 'usage_limit',
  loop: 'blocked',
};

/** The pause a failed turn of a goal causes (`FAILURE_PAUSES`). */
export function pauseReasonOf(failure: BotTurnFailure | null): BotGoalPauseReason {
  return (failure && FAILURE_PAUSES[failure]) || 'failed';
}

/**
 * What the end of one of the goal's turns means for it, once the turn is
 * counted (`BotGoalEntity.account`). Another turn's end, or a paused goal,
 * changes nothing. A turn the person stopped pauses it (`stopped`); one the
 * provider refused for a limit, quota or sign-in pauses it (`usage_limit`),
 * to resume once that passes, unless the provider named when its limit ends:
 * then the decision was held until that time (`waiting`) and the goal goes
 * on by itself. One the loop guard stopped, or that failed otherwise, pauses
 * it (`blocked`, `failed`). A turn stopped without fault
 * (`isTurnLimitFailure`: its model went silent, its worker restarted) goes on
 * like one that completed. Then: a claim that it is met is reviewed; a spent
 * budget or `BOT_GOAL_IDLE_TURNS` turns without a tool pause it; a goal set
 * with a limit before 2026-11-09 ends when it runs out; any other goes on.
 */
export function goalDecision(goal: BotGoalEntity, ended: EndedTurn): GoalDecision {
  if (!isGoalTurn(goal, ended) || goal.paused) return { kind: 'skip' };
  if (ended.status === 'cancelled') return { kind: 'pause', reason: 'stopped', note: null };
  if (ended.status === 'failed' && !stoppedAtTurnLimit(ended)) {
    const reason = pauseReasonOf(ended.failure);
    // Held until the provider's limit passed (`BotGoalEntity.hold`): it has,
    // so the goal's own bounds below decide, as after any other turn.
    if (reason !== 'usage_limit' || !goal.waiting) {
      return { kind: 'pause', reason, note: ended.error };
    }
  }
  if (ended.status !== 'completed' && ended.status !== 'failed') return { kind: 'skip' };
  if (goal.claim) return { kind: 'review' };
  if (goal.overBudget) return { kind: 'pause', reason: 'budget', note: null };
  if (goal.idle) return { kind: 'pause', reason: 'no_progress', note: null };
  if (goal.exhausted) return { kind: 'end', activity: 'exhausted', reason: null };
  return { kind: 'continue' };
}

/** Whether the turn was stopped without fault (`isTurnLimitFailure`) rather than failing. */
export function stoppedAtTurnLimit(ended: Pick<EndedTurn, 'status' | 'failure'>): boolean {
  return ended.status === 'failed' && isTurnLimitFailure(ended.failure);
}

/**
 * What the reviewer's verdict on the bot's claim does: met ends the goal;
 * out of reach without the person pauses it as `blocked`, with the reason;
 * not met yet withdraws the claim and goes on, the reason handed to the next
 * continuation, unless the goal's own bounds stop it first (its budget, its
 * idle turns, the limit of a goal set before 2026-11-09). No verdict (the reviewer failed, or answered nothing
 * readable) takes the bot at its word. A goal that would go on whose owner
 * can no longer act in the workspace (`props` null) stops, as `access_lost`.
 */
export function goalOutcome<Props>(
  goal: BotGoalEntity,
  verdict: BotGoalVerdict | null,
  props: Props | null,
): GoalOutcome<Props> {
  if (!verdict) return { kind: 'end', activity: 'met', reason: goal.claim };
  if (verdict.verdict === 'met') return { kind: 'end', activity: 'met', reason: verdict.reason };
  if (verdict.verdict === 'impossible') {
    return { kind: 'pause', reason: 'blocked', note: verdict.reason };
  }
  goal.rejectClaim();
  if (goal.overBudget) return { kind: 'pause', reason: 'budget', note: verdict.reason };
  if (goal.idle) return { kind: 'pause', reason: 'no_progress', note: verdict.reason };
  if (goal.exhausted) return { kind: 'end', activity: 'exhausted', reason: verdict.reason };
  return continueOrStop(props, verdict.reason);
}

/** Going on as `props`, or stopping when the owner can no longer act (`props` null). */
export function continueOrStop<Props>(
  props: Props | null,
  reason: string | null,
): GoalOutcome<Props> {
  if (props === null) return { kind: 'end', activity: 'stopped', reason: 'access_lost' };
  return { kind: 'continue', props, reason };
}

/**
 * The turn's message when the person runs `/goal <condition>`: the goal is
 * already set (`SendBotMessageCommandHandler`), so the turn starts on it with
 * the condition as its directive, and says how it will be judged.
 */
export function goalSetPrompt(condition: string): string {
  return [
    `The person set you a goal with /goal. Work toward it now: ${condition}`,
    'After each of your turns another one comes, for as long as the goal is open: take a real step each turn and report it. There is no limit on turns, so do the work properly rather than fast.',
    'When the condition holds, run the check it names, say what it answered, and call end_goal with outcome met: a reviewer then reads what you showed and ends the goal, or sends you on with its reason. It judges only what your words show: a claim with no shown check does not count.',
    'If the goal cannot go on without the person, call end_goal with outcome blocked and say what you need.',
  ].join('\n');
}

/**
 * A goal's count in words, the one place a text says it: "continuation 3"
 * (or "3 continuations"), with "of 20" for a goal set with a limit before
 * 2026-11-09.
 */
export function continuationCountText(
  goal: Pick<BotGoalEntity, 'limit'>,
  step: number,
  noun: 'continuation' | 'continuations' = 'continuation',
): string {
  const of = goal.limit === null ? '' : ` of ${goal.limit}`;
  return noun === 'continuations' ? `${step}${of} continuations` : `continuation ${step}${of}`;
}

/**
 * What a continuation tells the bot: the goal, which continuation it is, the
 * reviewer's reason when it found a claim not met yet, its budget, how to
 * end it, and, when its last turn stopped without fault, that its work is
 * kept.
 */
export function goalContinuationText(
  goal: BotGoalEntity,
  step: number,
  reason: string | null,
  lastStoppedAtLimit = false,
): string {
  return [
    `Continue toward your goal (${continuationCountText(goal, step)}): ${goal.objective}`,
    lastStoppedAtLimit
      ? "Your last turn stopped before it finished (its model went silent, the server restarted, or the model provider's limit stopped it and has since passed); what it did is kept. Check the state of anything it left in progress before repeating it."
      : null,
    reason
      ? `You said the goal is met, and a reviewer read your turn: it is not met yet. ${reason}`
      : 'Nobody wrote to you: this turn exists to make progress on the goal.',
    goal.tokenBudget === null
      ? null
      : `Budget: ${goal.tokensUsed.toLocaleString('en')} of ${goal.tokenBudget.toLocaleString('en')} tokens spent. The goal pauses when it is spent.`,
    'Read what your last turns did, take the next step, and say what it showed. A turn that calls no tool is not progress: after ' +
      `${BOT_GOAL_IDLE_TURNS} of them in a row the goal pauses.`,
    'When the goal is met, run its check, say what it answered and call end_goal with outcome met. When it cannot go on without the person, call end_goal with outcome blocked and say what you need.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * A continuation turn: in the background lane, after your messages and other
 * bots', on the bot's provider, model and effort as they are now, with the
 * setting turn's reach, opened by a goal line.
 */
export function goalContinuationTurn(
  props: Omit<Parameters<typeof BotTurnEntity.queue>[0], 'origin' | 'sourceKey' | 'lane'>,
  goal: BotGoalEntity,
  step: number,
  reason: string | null,
  lastStoppedAtLimit = false,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    origin: 'goal',
    lane: 'background',
    sourceKey: goalSourceKey(goal.id, step),
  });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content: goalContinuationText(goal, step, reason, lastStoppedAtLimit),
    event: {
      kind: 'goal',
      activity: 'continued',
      goalId: goal.id,
      objective: goal.objective,
      step,
      limit: goal.limit,
      reason,
    },
    steps: [],
    position: 0,
  });
  return { turn, opening };
}

const END_WORDS: Record<GoalEnding['activity'], string> = {
  met: 'A reviewer found your goal met',
  impossible: 'A reviewer found your goal cannot be met without the person',
  cleared: 'The person stopped your goal',
  exhausted: 'Your goal used all its continuations and stopped',
  stopped: 'Your goal stopped because its owner can no longer act in the workspace',
};

/** Why a goal paused, as the bot reads it in its history. */
const PAUSE_WORDS: Record<BotGoalPauseReason, string> = {
  blocked: 'Your goal is paused: it cannot go on without the person',
  usage_limit: 'Your goal is paused: the model provider refused for a limit, quota or sign-in',
  no_progress: `Your goal is paused: ${BOT_GOAL_IDLE_TURNS} of its turns in a row called no tool`,
  budget: 'Your goal is paused: it spent its token budget',
  stopped: 'Your goal is paused: the person stopped a turn of it',
  failed: 'Your goal is paused: a turn of it failed',
};

/**
 * A goal line about its pause or its resumption, outside any turn: the
 * person sees why and resumes it; the bot reads it in its history.
 */
export function goalPauseLine(
  goal: BotGoalEntity,
  activity: 'paused' | 'resumed',
): BotMessageEntity {
  const paused = goal.paused;
  const content =
    activity === 'resumed'
      ? `The person resumed your goal: ${goal.objective}`
      : [
          `${paused ? PAUSE_WORDS[paused.reason] : 'Your goal is paused'}: ${goal.objective}`,
          paused?.note ? `Why: ${paused.note}` : null,
          'It stays open; the person resumes it.',
        ]
          .filter(Boolean)
          .join('\n');
  return BotMessageEntity.createNew({
    organizationId: goal.organizationId,
    botId: goal.botId,
    turnId: null,
    role: 'event',
    content,
    event: {
      kind: 'goal',
      activity,
      goalId: goal.id,
      objective: goal.objective,
      step: goal.continuations,
      limit: goal.limit,
      reason: activity === 'paused' ? (paused?.reason ?? null) : null,
    },
    steps: [],
    position: 0,
  });
}

/** How a goal ended, as a line outside any turn that the person sees and the bot reads in its history. */
export function goalEndLine(
  goal: BotGoalEntity,
  activity: GoalEnding['activity'],
  reason: string | null,
): BotMessageEntity {
  return BotMessageEntity.createNew({
    organizationId: goal.organizationId,
    botId: goal.botId,
    turnId: null,
    role: 'event',
    content: [
      `${END_WORDS[activity]} (${continuationCountText(goal, goal.continuations, 'continuations')}): ${goal.objective}`,
      activity === 'stopped' || !reason ? null : `Reason: ${reason}`,
    ]
      .filter(Boolean)
      .join('\n'),
    event: {
      kind: 'goal',
      activity,
      goalId: goal.id,
      objective: goal.objective,
      step: goal.continuations,
      limit: goal.limit,
      reason,
    },
    steps: [],
    position: 0,
  });
}
