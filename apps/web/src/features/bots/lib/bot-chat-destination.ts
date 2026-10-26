import type { BotSection } from '@oppenheimer/shared/schemas/bot';

/**
 * Where a bot's chat opens (`28-bots-in-sections.md`): inside the section the
 * reader clicked it in, beside that section's own list, so they never leave
 * it (`/<section>/bots/$botId`); in Employees when no section is named. `path`
 * is the address, for a row that lights up while it is open.
 */
export function botChatDestination(section: BotSection | undefined, botId: string) {
  const base = section ? (`/${section}` as const) : '';
  return {
    to: `${base}/bots/$botId` as const,
    params: { botId },
    path: `${base}/bots/${botId}`,
  };
}
