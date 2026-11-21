/** The most commands a `/` menu lists at once. */
const SLASH_MENU_MAX = 8;

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

/**
 * A `/` menu over two lists: what matches in `lead` first, then what matches
 * in `follow` in the rows left, within one menu's worth. Which list leads and
 * what each leaves out (a name another command runs) is the caller's.
 */
export function leadThenFollow<Command extends Pick<SlashCommand, 'name'>>(
  lead: readonly Command[],
  follow: readonly Command[],
  query: string,
): [Command[], Command[]] {
  const first = matchingCommands(lead, query);
  return [first, matchingCommands(follow, query, SLASH_MENU_MAX - first.length)];
}
