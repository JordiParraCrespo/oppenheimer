import type { BotRoutineActivity } from '@oppenheimer/shared';
import type { AutomationRunOutcome, AutomationSkipReason } from '@oppenheimer/shared/automations';
import { BotMessageEntity } from './bot-message.entity';
import { BotTurnEntity } from './bot-turn.entity';

/** What fired, as a routine's turn opens with it (`26-bot-routines.md` §4). */
export interface RoutineFiring {
  automationId: string;
  runId: string;
  name: string;
  /**
   * The routine's prompt, with the event that fired it appended as untrusted
   * data when an event did (automations' `composeRunPrompt`).
   */
  instructions: string;
}

/**
 * The key that makes a routine's run one turn: a run dispatched twice finds
 * the turn the first dispatch queued. It names the routine first, so the
 * routine's live turns are found by prefix.
 */
export function routineSourceKey(automationId: string, runId: string): string {
  return `${routinePrefix(automationId)}${runId}`;
}

/** What a bot can do to its routines through `update_routine`. */
export const ROUTINE_ACTIONS = [
  'list',
  'create',
  'update',
  'pause',
  'resume',
  'delete',
  'run_now',
] as const;
export type RoutineAction = (typeof ROUTINE_ACTIONS)[number];

/**
 * Whether the owner has to consent to the bot doing this to a routine
 * (`26-bot-routines.md` §4): only what spends nothing and can be undone runs
 * without a card, which is reading the list and pausing. A run the bot starts
 * is spend nobody clicked for, so `run_now` asks like a save does.
 */
export function routineCallAsks(action: RoutineAction): boolean {
  return action !== 'list' && action !== 'pause';
}

/** Every turn of one routine's runs begins with this. */
export function routinePrefix(automationId: string): string {
  return `automation-run:${automationId}:`;
}

/** The words the bot reads when a routine fires: which one, then what it says to do. */
export function routineOpening(firing: RoutineFiring): string {
  return [
    `Your routine "${firing.name}" is running now, on its own: nobody wrote to you.`,
    'Do what it says, then report briefly what you did or found. If there is nothing worth saying, say so in one line.',
    '',
    firing.instructions,
  ].join('\n');
}

/**
 * A routine's turn: queued in the background lane, on the bot's provider,
 * model and effort as they are now, opened by an event line that names the
 * routine, keyed so the run queues it once.
 */
export function routineTurn(
  props: Omit<Parameters<typeof BotTurnEntity.queue>[0], 'origin' | 'sourceKey'>,
  firing: RoutineFiring,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    origin: 'routine',
    // Work nobody waits on: after your messages and other bots' (`BotQueueLanes`).
    lane: 'background',
    sourceKey: routineSourceKey(firing.automationId, firing.runId),
  });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content: routineOpening(firing),
    event: {
      kind: 'routine',
      activity: 'ran',
      automationId: firing.automationId,
      runId: firing.runId,
      name: firing.name,
      reason: null,
    },
    steps: [],
    position: 0,
  });
  return { turn, opening };
}

/** Something that became of a routine outside any turn, keyed by what reported it. */
export interface RoutineActivity {
  /** The domain event's id, so a delivery made twice is one line. */
  id: string;
  organizationId: string;
  botId: string;
  automationId: string;
  runId: string | null;
  name: string;
  activity: Exclude<BotRoutineActivity, 'ran'>;
  /** A pause's reason, or a failed run's skip reason or `expired`; null otherwise. */
  reason: string | null;
  /** When it happened: the event's own time, never when it was delivered. */
  at: Date;
}

/**
 * The skip reasons a bot's chat reports as a failed run. A run skipped because
 * the routine is paused, deleted, still busy with its last run or fired by our
 * own event did what the owner asked; one skipped because it could not start
 * is followed by the pause that says why (`bot_provider_missing`).
 */
const FAILED_SKIPS: readonly AutomationSkipReason[] = [
  'automation_rate_limited',
  'workspace_rate_limited',
  'missed',
  'agent_unavailable',
];

/**
 * Whether a run's new outcome is a failure the chat reports, and why:
 * `expired`, or the skip reason; null when there is nothing to say.
 */
export function routineFailureOf(
  outcome: AutomationRunOutcome,
  skipReason: AutomationSkipReason | null,
): string | null {
  if (outcome === 'expired') return 'expired';
  if (outcome === 'skipped' && skipReason && FAILED_SKIPS.includes(skipReason)) return skipReason;
  return null;
}

/** What the bot reads when its history reaches the line: the same news, in words. */
export function routineActivityText(activity: RoutineActivity): string {
  const name = `"${activity.name}"`;
  switch (activity.activity) {
    case 'saved':
      return `Your routine ${name} was saved.`;
    case 'changed':
      return `Your routine ${name} was changed.`;
    case 'paused':
      return activity.reason === 'bot_provider_missing'
        ? `Your routine ${name} was paused: your model provider has no key or sign-in, so it could not run.`
        : `Your routine ${name} was paused.`;
    case 'resumed':
      return `Your routine ${name} was resumed.`;
    case 'deleted':
      return `Your routine ${name} was deleted.`;
    case 'failed':
      return `A run of your routine ${name} did not start (${activity.reason ?? 'unknown'}).`;
  }
}

/**
 * A routine's activity as a line of its bot's chat (`26-bot-routines.md` §4,
 * "In the chat"): an event outside any turn, at the moment it happened,
 * however late the outbox delivers it.
 */
export function routineActivityLine(activity: RoutineActivity): BotMessageEntity {
  const line = BotMessageEntity.create({
    id: activity.id,
    createdAt: activity.at,
    updatedAt: activity.at,
    props: {
      organizationId: activity.organizationId,
      botId: activity.botId,
      turnId: null,
      role: 'event',
      content: routineActivityText(activity),
      event: {
        kind: 'routine',
        activity: activity.activity,
        automationId: activity.automationId,
        runId: activity.runId,
        name: activity.name,
        reason: activity.reason,
      },
      steps: [],
      position: 0,
    },
  });
  line.validate();
  return line;
}
