import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import {
  BOT_GOAL_CONTINUATIONS_PERSON,
  type BotGoalActivity,
  type BotTurnStatus,
  botGoalCommandOf,
  parseBotSlashCommand,
  type Scope,
} from '@oppenheimer/shared';
import { BotGoalEntity } from './bot-goal.entity';
import type { BotGoalVerdict } from './bot-goal-review.policy';
import { BotMessageEntity } from './bot-message.entity';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * A goal keeps a bot going (`25-bots.md` §4.1; from Grok Bot's goals,
 * `research/lessons-from-grok-bot.md` §9 row 10, and Claude Code's `/goal`).
 * When a turn of the goal ends, a reviewer says whether its condition holds
 * (`bot-goal-review.policy.ts`); while it does not, one continuation turn is
 * queued, keyed by the goal and its number, so an end delivered twice queues
 * one. A person's message, a routine or a wake may run in between: the
 * continuation waits its lane, and only the goal's own turns move it on.
 */

/** The key of a goal's `step`th continuation turn. */
export function goalSourceKey(goalId: string, step: number): string {
  return `${goalKeyPrefix(goalId)}${step}`;
}

/** What every goal continuation's key begins with. */
export const GOAL_KEY_PREFIX = 'goal:';

/** What every continuation key of a goal begins with: one queued blocks the next. */
export function goalKeyPrefix(goalId: string): string {
  return `${GOAL_KEY_PREFIX}${goalId}:`;
}

/** The turn that ended, as the decision reads it. */
export interface EndedTurn {
  id: string;
  sourceKey: string | null;
  status: BotTurnStatus;
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
 * commands"): `/goal <condition>` sets one on the turn it queues, with the
 * whole of the limit; null for any other message. `/goal` alone and
 * `/goal clear` are refused: they show and stop the goal, which the console
 * does with `GET` and `DELETE /bots/:id/goal`, and as a message they would
 * spend a turn to say what the notice already shows.
 */
export function goalFromMessage(content: string, turn: GoalSettingTurn): BotGoalEntity | null {
  const command = botGoalCommandOf(parseBotSlashCommand(content));
  if (!command) return null;
  if (command.kind !== 'set') {
    throw new ArgumentInvalidException(
      '/goal alone and /goal clear are not messages: read the goal with GET /bots/:id/goal and stop it with DELETE /bots/:id/goal',
    );
  }
  return BotGoalEntity.set({
    organizationId: turn.organizationId,
    botId: turn.botId,
    originTurnId: turn.id,
    objective: command.condition,
    limit: BOT_GOAL_CONTINUATIONS_PERSON,
    credentialScopes: turn.credentialScopes,
    timeZone: turn.timeZone,
  });
}

/** What the end of a turn means for the goal, before the reviewer is asked. */
export type GoalDecision =
  | { kind: 'review' }
  | { kind: 'skip' }
  | { kind: 'end'; activity: 'stopped'; reason: string | null };

/** What the goal does once the reviewer has answered, or could not. */
export type GoalOutcome =
  | { kind: 'continue'; reason: string | null }
  | {
      kind: 'end';
      activity: Extract<BotGoalActivity, 'met' | 'impossible' | 'exhausted'>;
      reason: string | null;
    };

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
 * What the end of one of the goal's turns means for it. One that failed or
 * was stopped stops it: a person's Stop is a stop, and a failure would only
 * fail again. One that completed is reviewed. Another turn's end changes
 * nothing.
 */
export function goalDecision(goal: BotGoalEntity, ended: EndedTurn): GoalDecision {
  if (!isGoalTurn(goal, ended)) return { kind: 'skip' };
  if (ended.status === 'failed' || ended.status === 'cancelled') {
    return { kind: 'end', activity: 'stopped', reason: ended.status };
  }
  if (ended.status !== 'completed') return { kind: 'skip' };
  return { kind: 'review' };
}

/**
 * What the reviewer's verdict does to the goal: met or out of reach ends it;
 * otherwise it goes on while it has continuations left, the reason handed to
 * the next one. No verdict (the reviewer failed, or answered nothing
 * readable) goes on too: the limit still bounds it, and the bot can end it.
 */
export function goalOutcome(goal: BotGoalEntity, verdict: BotGoalVerdict | null): GoalOutcome {
  if (verdict?.verdict === 'met') return { kind: 'end', activity: 'met', reason: verdict.reason };
  if (verdict?.verdict === 'impossible') {
    return { kind: 'end', activity: 'impossible', reason: verdict.reason };
  }
  const reason = verdict?.reason ?? null;
  if (goal.exhausted) return { kind: 'end', activity: 'exhausted', reason };
  return { kind: 'continue', reason };
}

/**
 * The turn's message when the person runs `/goal <condition>`: the goal is
 * already set (`SendBotMessageCommandHandler`), so the turn starts on it with
 * the condition as its directive, and says how it will be judged.
 */
export function goalSetPrompt(condition: string): string {
  return [
    `The person set you a goal with /goal. Work toward it now: ${condition}`,
    "After each of your turns a reviewer reads what you showed and decides whether the condition holds. While it does not, you get another turn to go on, with the reviewer's reason. It judges only what your words show, so run the check the condition names and say what it answered: a claim with no shown check does not count.",
    'If the goal cannot be met without the person, say so and why, and call end_goal.',
  ].join('\n');
}

/** What a continuation tells the bot: the goal, where it is in its count, the reviewer's reason, and how to stop. */
export function goalContinuationText(
  goal: BotGoalEntity,
  step: number,
  reason: string | null,
): string {
  return [
    `Continue toward your goal (continuation ${step} of ${goal.limit}): ${goal.objective}`,
    reason
      ? `A reviewer read your last turn and says it is not met yet: ${reason}`
      : 'Nobody wrote to you: this turn exists to make progress on the goal.',
    'Read what your last turns did, take the next step, run the check the goal names, and say what it showed.',
    'When the goal is met, or it cannot be met without the person, call end_goal and say why. Do not stretch the work to fill the continuations left.',
  ].join('\n');
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
    content: goalContinuationText(goal, step, reason),
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

const END_WORDS: Record<Exclude<BotGoalActivity, 'continued'>, string> = {
  met: 'A reviewer found your goal met',
  impossible: 'A reviewer found your goal cannot be met without the person',
  cleared: 'The person stopped your goal',
  exhausted: 'Your goal used all its continuations and stopped',
  stopped: 'Your goal stopped because a turn of it failed or was stopped',
};

/** How a goal ended, as a line outside any turn that the person sees and the bot reads in its history. */
export function goalEndLine(
  goal: BotGoalEntity,
  activity: Exclude<BotGoalActivity, 'continued'>,
  reason: string | null,
): BotMessageEntity {
  return BotMessageEntity.createNew({
    organizationId: goal.organizationId,
    botId: goal.botId,
    turnId: null,
    role: 'event',
    content: [
      `${END_WORDS[activity]} (${goal.continuations} of ${goal.limit} continuations): ${goal.objective}`,
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
