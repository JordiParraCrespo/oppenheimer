import { BOT_LOOP_SELF_PACED_MAX_MINUTES } from '@oppenheimer/shared';
import type { BotLoopEntity } from './bot-loop.entity';
import { type LoopEnding, loopSourceKey } from './bot-loop.policy';
import { BotMessageEntity } from './bot-message.entity';
import { repeatedBlockerAsk } from './bot-recovery.policy';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * What a loop says (`25-bots.md` §4.1, `/loop`): the words the bot reads when
 * a loop is set and at each run, and the turns and lines that carry them. The
 * decisions (when a run is due, whether the loop ends) are
 * `bot-loop.policy.ts`; this builds what they act on.
 */

/** "every 5 minutes", "every 2 hours", or "when you choose", for the bot's words. */
function cadenceOf(intervalMinutes: number | null): string {
  if (intervalMinutes === null) return 'when you choose';
  if (intervalMinutes % 1_440 === 0) return plural(intervalMinutes / 1_440, 'day');
  if (intervalMinutes % 60 === 0) return plural(intervalMinutes / 60, 'hour');
  return plural(intervalMinutes, 'minute');
}

function plural(count: number, unit: string): string {
  return count === 1 ? `every ${unit}` : `every ${count} ${unit}s`;
}

/** What a run asks of the bot beyond its prompt: how it ends, and for a self-paced loop how it goes on. */
function loopRules(selfPaced: boolean): string[] {
  return [
    'Do it now and report briefly what you found; if nothing changed since your last run, say so in a line.',
    selfPaced
      ? `Before you finish, call schedule_loop with when to run next, 1 to ${BOT_LOOP_SELF_PACED_MAX_MINUTES} minutes from now: sooner while things are changing, later when they are quiet. If you do not, the loop ends.`
      : null,
    repeatedBlockerAsk('call end_loop and say why'),
    'When the loop has served its purpose (what it watches finished, or it cannot go on without the person), call end_loop and say why.',
  ].filter((line): line is string => line !== null);
}

/** The setting turn's message when the person runs `/loop`: the loop is set, and this is its first run. */
export function loopSetPrompt(intervalMinutes: number | null, prompt: string): string {
  return [
    `The person set a loop with /loop: you run this ${cadenceOf(intervalMinutes)} for up to 3 days, and this is the first run: ${prompt}`,
    ...loopRules(intervalMinutes === null),
  ].join('\n');
}

/** What a run tells the bot; `shown` counts the setting turn as run 1. */
export function loopRunText(loop: BotLoopEntity, shown: number): string {
  return [
    `Run ${shown} of your loop, which the person set with /loop to run ${cadenceOf(loop.intervalMinutes)}: ${loop.prompt}`,
    'Nobody wrote to you: this turn exists for the loop. Read what your last runs found, so you report what is new.',
    ...loopRules(loop.selfPaced),
  ].join('\n');
}

/**
 * A run's turn: in the background lane, after your messages and other
 * bots', on the bot's engine as it is now, with the setting turn's reach,
 * opened by a loop line. `run` is the loop's count of queued runs, so the
 * line, which counts the setting turn as the first, says one more.
 */
export function loopRunTurn(
  props: Omit<Parameters<typeof BotTurnEntity.queue>[0], 'origin' | 'sourceKey' | 'lane'>,
  loop: BotLoopEntity,
  run: number,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    origin: 'loop',
    lane: 'background',
    sourceKey: loopSourceKey(loop.id, run),
  });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content: loopRunText(loop, run + 1),
    event: {
      kind: 'loop',
      activity: 'ran',
      loopId: loop.id,
      prompt: loop.prompt,
      intervalMinutes: loop.intervalMinutes,
      run: run + 1,
      reason: null,
    },
    steps: [],
    position: 0,
  });
  return { turn, opening };
}

const END_WORDS: Record<LoopEnding['activity'], string> = {
  cleared: 'The person stopped your loop',
  expired: 'Your loop ran for 3 days and expired',
  stopped: 'Your loop stopped because a run of it failed or was stopped',
  ended: 'Your loop ended: its last run did not call schedule_loop',
};

/** How a loop ended, as a line outside any turn that the person sees and the bot reads in its history. */
export function loopEndLine(
  loop: BotLoopEntity,
  activity: LoopEnding['activity'],
  reason: string | null,
): BotMessageEntity {
  return BotMessageEntity.createNew({
    organizationId: loop.organizationId,
    botId: loop.botId,
    turnId: null,
    role: 'event',
    content: `${END_WORDS[activity]} (after ${loop.runs + 1} runs): ${loop.prompt}`,
    event: {
      kind: 'loop',
      activity,
      loopId: loop.id,
      prompt: loop.prompt,
      intervalMinutes: loop.intervalMinutes,
      run: loop.runs + 1,
      reason,
    },
    steps: [],
    position: 0,
  });
}
