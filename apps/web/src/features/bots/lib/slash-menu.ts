import { BOT_BUILT_IN_COMMANDS } from '@oppenheimer/shared/schemas/bot-skill';

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

/**
 * The skills the menu offers: the built-in skills the person may run
 * (`/recap`) first, then the bot's own that they may run. A skill of the
 * bot's saved under a built-in skill's name before it was reserved is the
 * one `/<name>` means, so the built-in gives way to it, even when only the
 * bot may use it and the menu offers neither.
 */
export function runnableSkills<Skill extends SlashCommand>(
  builtInSkills: readonly Skill[],
  own: readonly (Skill & { userInvocable: boolean })[],
): Skill[] {
  const shadowed = new Set(own.map((skill) => skill.name));
  return [
    ...builtInSkills.filter((skill) => !shadowed.has(skill.name)),
    ...own.filter((skill) => skill.userInvocable),
  ];
}

/** The draft once a command is picked: the command and a space for its input. */
export function pickedDraft(command: Pick<SlashCommand, 'name'>): string {
  return `/${command.name} `;
}
