import type { BotSection } from '@oppenheimer/shared/schemas/bot';

/**
 * Where a bot's chat opens from a section (`28-bots-in-sections.md`): inside
 * Pull requests, beside its own list, as the export draws it; in Employees
 * from every other section, and from none. `path` is the address, for a row
 * that lights up while it is open.
 */
export function botChatDestination(section: BotSection | undefined, botId: string) {
  return section === 'pulls'
    ? ({ to: '/pulls/bots/$botId', params: { botId }, path: `/pulls/bots/${botId}` } as const)
    : ({ to: '/bots/$botId', params: { botId }, path: `/bots/${botId}` } as const);
}
