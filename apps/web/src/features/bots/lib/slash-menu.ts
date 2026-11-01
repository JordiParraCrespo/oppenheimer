import type { BotSkillEntity } from '@oppenheimer/frontend-consumer';

/** The most commands the `/` menu lists at once. */
const SLASH_MENU_MAX = 8;

/**
 * What the person is typing after `/`, while the draft is only a command
 * being written (`/rel`, or `/` alone); null once it has a space, a second
 * line or anything before the slash, when the menu has nothing to offer.
 */
export function slashQuery(draft: string): string | null {
  const match = /^\/([a-z0-9-]*)$/.exec(draft);
  return match ? (match[1] ?? '') : null;
}

/** The skills whose names start with what is typed, then those that contain it, by name. */
export function matchingCommands(
  skills: readonly BotSkillEntity[],
  query: string,
): BotSkillEntity[] {
  const starts = skills.filter((skill) => skill.name.startsWith(query));
  const contains = skills.filter(
    (skill) => !skill.name.startsWith(query) && skill.name.includes(query),
  );
  return [...starts, ...contains].slice(0, SLASH_MENU_MAX);
}

/** The draft once a command is picked: the command and a space for its input. */
export function pickedDraft(skill: Pick<BotSkillEntity, 'name'>): string {
  return `/${skill.name} `;
}
