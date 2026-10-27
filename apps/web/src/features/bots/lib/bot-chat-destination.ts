import type { BotSection } from '@oppenheimer/shared/schemas/bot';

/**
 * Each section's bot chat route (`28-bots-in-sections.md`): a chat opens
 * inside the section it was clicked in, beside that section's own list, so
 * the reader never leaves it. Listed rather than built from the section's
 * name, so a renamed or missing route is a compile error.
 */
const SECTION_CHAT = {
  sessions: '/sessions/bots/$botId',
  automations: '/automations/bots/$botId',
  plan: '/plan/bots/$botId',
  pulls: '/pulls/bots/$botId',
} as const satisfies Record<BotSection, string>;

const EMPLOYEES_CHAT = '/bots/$botId';

/**
 * Where a bot's chat opens: in `section`, or in Employees when none is named.
 * `path` is the address, for a row that lights up while it is open.
 */
export function botChatDestination(section: BotSection | undefined, botId: string) {
  const to = section ? SECTION_CHAT[section] : EMPLOYEES_CHAT;
  return { to, params: { botId }, path: to.replace('$botId', botId) };
}

/** The section whose chat of `botId` is open at `pathname`; undefined when none is. */
export function sectionShowingChat(pathname: string, botId: string): BotSection | undefined {
  return (Object.keys(SECTION_CHAT) as BotSection[]).find(
    (section) => SECTION_CHAT[section].replace('$botId', botId) === pathname,
  );
}
