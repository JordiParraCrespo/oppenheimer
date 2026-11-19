/** The most commands a `/` menu lists at once. */
export const SLASH_MENU_MAX = 8;

/**
 * One row of a composer's `/` menu: something `/<name>` runs, with the
 * command as the menu writes it and what it does.
 */
export interface SlashCommand {
  id: string;
  name: string;
  command: string;
  description: string;
}

/** The commands whose names start with what is typed, then those that contain it, at most a menu's worth. */
export function matchingCommands<Command extends Pick<SlashCommand, 'name'>>(
  commands: readonly Command[],
  query: string,
  max = SLASH_MENU_MAX,
): Command[] {
  const starts = commands.filter((command) => command.name.startsWith(query));
  const contains = commands.filter(
    (command) => !command.name.startsWith(query) && command.name.includes(query),
  );
  return [...starts, ...contains].slice(0, max);
}
