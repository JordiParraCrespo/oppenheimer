import { BOT_LOOP_SELF_PACED_MAX_MINUTES } from '@oppenheimer/shared';
import type { BotLoopEntity } from './bot-loop.entity';
import { type LoopEnding, loopSourceKey } from './bot-loop.policy';
import { BotMessageEntity } from './bot-message.entity';
import { promptText } from './bot-prompt-text.policy';
import { repeatedBlockerAsk } from './bot-recovery.policy';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * What a loop says (`/loop`): the words the bot reads when
 * a loop is set and at each run, and the turns and lines that carry them. The
 * decisions (when a run is due, whether the loop ends) are
 * `bot-loop.policy.ts`; this builds what they act on.
 */

/** "every 5 minutes", "every 2 hours", or "when you choose", for the bot's words. */
function cadenceOf(intervalMinutes: number | null): string {
  if (intervalMinutes === null) return promptText('routines/wake-loop.when-you-choose');
  // A loop runs once a day at most (`BOT_LOOP_INTERVAL_MAX_MINUTES`), so days are never counted.
  if (intervalMinutes === 1_440) return promptText('routines/wake-loop.every-day');
  if (intervalMinutes % 60 === 0) {
    return every(
      intervalMinutes / 60,
      'routines/wake-loop.every-hour',
      'routines/wake-loop.every-hours',
    );
  }
  return every(
    intervalMinutes,
    'routines/wake-loop.every-minute',
    'routines/wake-loop.every-minutes',
  );
}

function every(
  count: number,
  one: 'routines/wake-loop.every-hour' | 'routines/wake-loop.every-minute',
  many: 'routines/wake-loop.every-hours' | 'routines/wake-loop.every-minutes',
): string {
  return count === 1 ? promptText(one) : promptText(many, { count: String(count) });
}

/** What a run asks of the bot beyond its prompt: how it ends, and for a self-paced loop how it goes on. */
function loopRules(selfPaced: boolean): string[] {
  return [
    promptText('routines/wake-loop.do-it-now'),
    selfPaced
      ? promptText('routines/wake-loop.schedule-the-next', {
          max: String(BOT_LOOP_SELF_PACED_MAX_MINUTES),
        })
      : null,
    repeatedBlockerAsk(promptText('routines/wake-loop.quiet')),
    promptText('routines/wake-loop.when-it-has-served'),
  ].filter((line): line is string => line !== null);
}

/** The setting turn's message when the person runs `/loop`: the loop is set, and this is its first run. */
export function loopSetPrompt(intervalMinutes: number | null, prompt: string): string {
  return [
    promptText('core/turn-slash-command.loop-set', { cadence: cadenceOf(intervalMinutes), prompt }),
    ...loopRules(intervalMinutes === null),
  ].join('\n');
}

/** What a run tells the bot; `shown` counts the setting turn as run 1. */
export function loopRunText(loop: BotLoopEntity, shown: number): string {
  return [
    promptText('routines/wake-loop.run', {
      shown: String(shown),
      cadence: cadenceOf(loop.intervalMinutes),
      prompt: loop.prompt,
    }),
    promptText('routines/wake-loop.nobody-wrote'),
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
  cleared: promptText('routines/wake-loop.ended-cleared'),
  expired: promptText('routines/wake-loop.ended-expired'),
  stopped: promptText('routines/wake-loop.ended-stopped'),
  ended: promptText('routines/wake-loop.ended-ended'),
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
    content: promptText('routines/wake-loop.end-line', {
      ended: END_WORDS[activity],
      runs: String(loop.runs + 1),
      prompt: loop.prompt,
    }),
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
