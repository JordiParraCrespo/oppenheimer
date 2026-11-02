import { botGoalCommandOf, parseBotSlashCommand } from '@oppenheimer/shared/schemas/bot-skill';

/**
 * What a built-in command in the draft asks of the composer (`25-bots.md`
 * §4.1, "Built-in commands"), before anything is sent:
 *
 * - `notice`: the draft cannot be sent as it is; send stays off and the
 *   notice on the box's top edge says why (`/goal` with no condition);
 * - `local`: the console runs it itself and sends the bot nothing
 *   (`/goal clear` stops the goal, `/usage` opens the usage card);
 * - null: the draft is a message, built-in or not (`/goal <condition>` is
 *   sent; the API sets the goal).
 *
 * A new built-in adds its case here and its action to `useBuiltInCommand`,
 * so the composer keeps one notice and one local action whatever the draft.
 */
export type BuiltInCommandAction =
  | { kind: 'notice'; notice: 'goalNeedsCondition' }
  | { kind: 'local'; action: 'clearGoal' | 'openUsage' }
  | null;

export function builtInCommandActionOf(draft: string): BuiltInCommandAction {
  const command = parseBotSlashCommand(draft);
  if (command?.name === 'usage') return { kind: 'local', action: 'openUsage' };
  const goal = botGoalCommandOf(command);
  if (goal?.kind === 'show') return { kind: 'notice', notice: 'goalNeedsCondition' };
  if (goal?.kind === 'clear') return { kind: 'local', action: 'clearGoal' };
  return null;
}
