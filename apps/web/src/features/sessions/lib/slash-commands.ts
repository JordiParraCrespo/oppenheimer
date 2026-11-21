import { leadThenFollow, type SlashCommand } from '@oppenheimer/frontend-web';
import type { ChatCommand } from '@oppenheimer/shared/protocol';

/**
 * Claude Code's own commands the chat's `/` menu offers: the ones that act in
 * the terminal and answer in the transcript, so the chat shows what they did.
 * A command that opens a picker or an editor in the terminal is left out.
 */
const CLAUDE_BUILT_IN_COMMANDS = ['clear', 'compact', 'context', 'cost', 'init', 'review'] as const;

type BuiltIn = (typeof CLAUDE_BUILT_IN_COMMANDS)[number];

/** What each built-in says in the menu, by its translation key. */
const BUILT_IN_DESCRIPTIONS = {
  clear: 'sessions.chat.slash.builtIn.clear',
  compact: 'sessions.chat.slash.builtIn.compact',
  context: 'sessions.chat.slash.builtIn.context',
  cost: 'sessions.chat.slash.builtIn.cost',
  init: 'sessions.chat.slash.builtIn.init',
  review: 'sessions.chat.slash.builtIn.review',
} as const satisfies Record<BuiltIn, string>;

type BuiltInDescriptionKey = (typeof BUILT_IN_DESCRIPTIONS)[BuiltIn];

/**
 * What the person is typing after `/`, while the draft is only a command
 * being written (`/rec`, `/frontend:au`, or `/` alone); null once it has a
 * space, a second line or anything before the slash. A name takes what a
 * project's command may (`chatCommandSchema`).
 */
export function sessionSlashQuery(draft: string): string | null {
  const match = /^\/([A-Za-z0-9_.:-]*)$/.exec(draft);
  return match ? (match[1] ?? '') : null;
}

/**
 * The menu's rows for what is typed: the project's skills and commands that
 * match first, since they are what the person cannot type from memory, then
 * Claude Code's built-ins, within the menu's cap. A project's command under a
 * built-in's name is left out, since `/<name>` runs the built-in.
 */
export function sessionSlashRows(
  query: string,
  project: readonly ChatCommand[],
  describe: (key: BuiltInDescriptionKey) => string,
): { project: SlashCommand[]; builtIns: SlashCommand[] } {
  const reserved: readonly string[] = CLAUDE_BUILT_IN_COMMANDS;
  const [own, builtIns] = leadThenFollow(
    project
      .filter((command) => !reserved.includes(command.name))
      .map((command) => ({
        id: `${command.kind}:${command.name}`,
        name: command.name,
        command: `/${command.name}`,
        description: command.description ?? '',
      })),
    CLAUDE_BUILT_IN_COMMANDS.map((name) => ({
      id: `built-in:${name}`,
      name,
      command: `/${name}`,
      description: describe(BUILT_IN_DESCRIPTIONS[name]),
    })),
    query,
  );
  return { project: own, builtIns };
}
