import {
  BOT_BUILT_IN_COMMANDS,
  BOT_RUNNABLE_BUILT_IN_SKILL_NAMES,
} from '@oppenheimer/shared/schemas/bot-skill';

/** The most commands the `/` menu lists at once. */
const SLASH_MENU_MAX = 8;

/**
 * One row of the `/` menu: a built-in command Oppenheimer runs (`/goal`), or
 * one of the bot's skills the person may run. A skill entity is one as it is.
 */
export interface SlashCommand {
  id: string;
  name: string;
  command: string;
  description: string;
}

/**
 * What the person is typing after `/`, while the draft is only a command
 * being written (`/rel`, or `/` alone); null once it has a space, a second
 * line or anything before the slash, when the menu has nothing to offer.
 */
export function slashQuery(draft: string): string | null {
  const match = /^\/([a-z0-9-]*)$/.exec(draft);
  return match ? (match[1] ?? '') : null;
}

/** The commands whose names start with what is typed, then those that contain it, by name. */
export function matchingCommands<Command extends Pick<SlashCommand, 'name'>>(
  commands: readonly Command[],
  query: string,
): Command[] {
  const starts = commands.filter((command) => command.name.startsWith(query));
  const contains = commands.filter(
    (command) => !command.name.startsWith(query) && command.name.includes(query),
  );
  return [...starts, ...contains].slice(0, SLASH_MENU_MAX);
}

/**
 * The menu's rows: the built-ins that match first, then the skills, within
 * the menu's cap. A skill saved under a name that is now a built-in's is
 * left out, since its `/<name>` runs the built-in.
 */
export function slashMenuItems(
  builtIns: readonly SlashCommand[],
  skills: readonly SlashCommand[],
  query: string,
): { builtIns: SlashCommand[]; skills: SlashCommand[] } {
  // Only a command's name runs something else; a skill under a built-in
  // skill's name (`oppenheimer`) is still the bot's and still runs.
  const reserved: readonly string[] = ['skill', ...BOT_BUILT_IN_COMMANDS];
  const ownBuiltIns = matchingCommands(builtIns, query);
  const ownSkills = matchingCommands(
    skills.filter((skill) => !reserved.includes(skill.name)),
    query,
  ).slice(0, SLASH_MENU_MAX - ownBuiltIns.length);
  return { builtIns: ownBuiltIns, skills: ownSkills };
}

/** What each built-in says in the menu, by its translation key. */
const BUILT_IN_DESCRIPTIONS = {
  goal: 'bots.chat.slash.builtIn.goal',
  usage: 'bots.chat.slash.builtIn.usage',
  loop: 'bots.chat.slash.builtIn.loop',
  schedule: 'bots.chat.slash.builtIn.schedule',
  recap: 'bots.chat.slash.builtInSkill.recap',
} as const satisfies Record<
  (typeof BOT_BUILT_IN_COMMANDS)[number] | (typeof BOT_RUNNABLE_BUILT_IN_SKILL_NAMES)[number],
  string
>;

/** A translation key a built-in's row reads its description from. */
type SlashDescriptionKey = (typeof BUILT_IN_DESCRIPTIONS)[keyof typeof BUILT_IN_DESCRIPTIONS];

/** A skill of the bot's own, as the menu reads it. */
type OwnSkill = SlashCommand & { userInvocable: boolean };

/**
 * The `/` menu's rows for a bot, the one place that decides them: the
 * built-in commands, always; then the built-in skills the person may run
 * (`/recap`), then the bot's own that they may run. A skill of the bot's
 * saved under a built-in skill's name before it was reserved is the one
 * `/<name>` means, so the built-in gives way to it, even when only the bot
 * may use it and the menu offers neither; and until the bot's skills are read
 * (`undefined`: loading, or the read failed) that cannot be told, so no
 * skill is offered yet.
 */
export function slashMenuRows(
  query: string,
  own: readonly OwnSkill[] | undefined,
  describe: (key: SlashDescriptionKey) => string,
): { builtIns: SlashCommand[]; skills: SlashCommand[] } {
  const row = (kind: string, name: keyof typeof BUILT_IN_DESCRIPTIONS): SlashCommand => ({
    id: `${kind}:${name}`,
    name,
    command: `/${name}`,
    description: describe(BUILT_IN_DESCRIPTIONS[name]),
  });
  const builtIns = BOT_BUILT_IN_COMMANDS.map((name) => row('built-in', name));
  if (!own) return slashMenuItems(builtIns, [], query);
  const shadowed = new Set(own.map((skill) => skill.name));
  const skills = [
    ...BOT_RUNNABLE_BUILT_IN_SKILL_NAMES.filter((name) => !shadowed.has(name)).map((name) =>
      row('built-in-skill', name),
    ),
    ...own.filter((skill) => skill.userInvocable),
  ];
  return slashMenuItems(builtIns, skills, query);
}

/** The draft once a command is picked: the command and a space for its input. */
export function pickedDraft(command: Pick<SlashCommand, 'name'>): string {
  return `/${command.name} `;
}

/**
 * The `/command` a message starts with (`/ship` in `/ship fix the build`),
 * marked in the composer and in the sent bubble; null when it does not start
 * with one. Any name a skill could take counts, whether or not the bot has it.
 */
export function leadingCommand(text: string): string | null {
  return /^\/[a-z0-9][a-z0-9-]{0,31}(?=\s|$)/.exec(text)?.[0] ?? null;
}
