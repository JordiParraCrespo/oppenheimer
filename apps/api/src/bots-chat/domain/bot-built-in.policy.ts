import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import {
  type BotBuiltInCommand,
  isBotConsoleCommand,
  parseBotSlashCommand,
} from '@oppenheimer/shared';

/**
 * Where each built-in's console side lives in the API (`25-bots.md` §4.1,
 * "Built-in commands"): what a client calls instead of sending the command.
 * A new built-in is an entry here, which the compiler asks for.
 */
const CONSOLE_ROUTES: Record<BotBuiltInCommand, string> = {
  goal: 'GET /bots/:id/goal to read the goal, DELETE /bots/:id/goal to stop it',
  usage: 'GET /bots/:id/usage',
};

/**
 * Refuses a message that is a built-in the console runs itself
 * (`isBotConsoleCommand`: `/goal` alone, `/goal clear`, `/usage`): as a
 * message it would spend a turn to say what the console shows, and do
 * nothing it asks. The refusal names the command typed and where its
 * console side is.
 */
export function refuseConsoleCommand(content: string): void {
  const command = parseBotSlashCommand(content);
  if (!command || !isBotConsoleCommand(command)) return;
  const route = CONSOLE_ROUTES[command.name as BotBuiltInCommand];
  throw new ArgumentInvalidException(
    `/${command.name} is run by the console, not sent to the bot: use ${route}`,
  );
}
