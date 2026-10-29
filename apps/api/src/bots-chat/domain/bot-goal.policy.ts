import type { BotGoalActivity, BotTurnStatus } from '@oppenheimer/shared';
import type { BotGoalEntity } from './bot-goal.entity';
import { BotMessageEntity } from './bot-message.entity';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * A goal keeps a bot going (`25-bots.md` §4.1; from Grok Bot's goals,
 * `research/lessons-from-grok-bot.md` §9 row 10). When a turn of the bot
 * ends and the goal is still open, one continuation turn is queued, keyed by
 * the goal and its number, so an end delivered twice queues one. A person's
 * message, a routine or a wake may run in between: the continuation waits
 * its lane, and only the goal's own turns move it on.
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

export type GoalDecision =
  | { kind: 'continue' }
  | { kind: 'skip' }
  | {
      kind: 'end';
      activity: Extract<BotGoalActivity, 'exhausted' | 'stopped'>;
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
 * fail again. Past its limit, it ends. Another turn's end changes nothing.
 */
export function goalDecision(goal: BotGoalEntity, ended: EndedTurn): GoalDecision {
  if (!isGoalTurn(goal, ended)) return { kind: 'skip' };
  if (ended.status === 'failed' || ended.status === 'cancelled') {
    return { kind: 'end', activity: 'stopped', reason: ended.status };
  }
  if (ended.status !== 'completed') return { kind: 'skip' };
  if (goal.exhausted) return { kind: 'end', activity: 'exhausted', reason: null };
  return { kind: 'continue' };
}

/** What a continuation tells the bot: the goal, where it is in its count, and how to stop. */
export function goalContinuationText(goal: BotGoalEntity, step: number): string {
  return [
    `Continue toward your goal (continuation ${step} of ${goal.limit}): ${goal.objective}`,
    'Nobody wrote to you: you set this goal, and this turn exists to make progress on it. Read what your last turns did, take the next step, and say in a line where it stands.',
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
    content: goalContinuationText(goal, step),
    event: {
      kind: 'goal',
      activity: 'continued',
      goalId: goal.id,
      objective: goal.objective,
      step,
      limit: goal.limit,
      reason: null,
    },
    steps: [],
    position: 0,
  });
  return { turn, opening };
}

const END_WORDS: Record<Exclude<BotGoalActivity, 'continued'>, string> = {
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
    content: `${END_WORDS[activity]} (${goal.continuations} of ${goal.limit} continuations): ${goal.objective}`,
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
