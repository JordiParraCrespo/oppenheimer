import {
  botGoalCommandOf,
  botLoopCommandOf,
  botScheduleCommandOf,
  parseBotSlashCommand,
} from '@oppenheimer/shared/schemas/bot-skill';

/**
 * What a built-in command in the draft asks of the composer (`25-bots.md`
 * §4.1, "Built-in commands"), before anything is sent:
 *
 * - `notice`: the draft cannot be sent as it is; send stays off and the
 *   notice on the box's top edge says why (`/goal` with no condition, a
 *   `/loop` interval out of range);
 * - `local`: the console runs it itself and sends the bot nothing
 *   (`/goal clear` stops the goal, `/goal resume` runs a paused one again,
 *   `/loop stop` the loop, `/usage` opens the
 *   usage card, `/schedule` alone opens the bot's routines);
 * - null: the draft is a message, built-in or not (`/goal <condition>`,
 *   `/loop …` and `/schedule <request>` are sent; the API sets the goal or
 *   the loop, the bot saves the routine).
 *
 * A new built-in adds its case here and its entry to `useBuiltInCommand`'s
 * table of local actions, so the composer keeps one notice and one local
 * action whatever the draft.
 */
export type BuiltInLocalAction =
  | 'clearGoal'
  | 'resumeGoal'
  | 'clearLoop'
  | 'openUsage'
  | 'openRoutines';

export type BuiltInCommandAction =
  | { kind: 'notice'; notice: 'goalNeedsCondition' | 'loopBadInterval' }
  | { kind: 'local'; action: BuiltInLocalAction }
  | null;

export function builtInCommandActionOf(draft: string): BuiltInCommandAction {
  const command = parseBotSlashCommand(draft);
  if (command?.name === 'usage') return { kind: 'local', action: 'openUsage' };
  if (botScheduleCommandOf(command)?.kind === 'open') {
    return { kind: 'local', action: 'openRoutines' };
  }
  const loop = botLoopCommandOf(command);
  if (loop?.kind === 'invalid') return { kind: 'notice', notice: 'loopBadInterval' };
  if (loop?.kind === 'clear') return { kind: 'local', action: 'clearLoop' };
  const goal = botGoalCommandOf(command);
  if (goal?.kind === 'show') return { kind: 'notice', notice: 'goalNeedsCondition' };
  if (goal?.kind === 'clear') return { kind: 'local', action: 'clearGoal' };
  if (goal?.kind === 'resume') return { kind: 'local', action: 'resumeGoal' };
  return null;
}
