import type { BotSection } from '@oppenheimer/shared/schemas/bot';

/**
 * Where a bot's chat opens (`28-bots-in-sections.md`): inside the section the
 * reader clicked it in, beside that section's own list, so they never leave
 * it; in Employees when no section is named. `path` is the address, for a row
 * that lights up while it is open.
 */
export function botChatDestination(section: BotSection | undefined, botId: string) {
  const params = { botId };
  switch (section) {
    case 'sessions':
      return { to: '/sessions/bots/$botId', params, path: `/sessions/bots/${botId}` } as const;
    case 'automations':
      return {
        to: '/automations/bots/$botId',
        params,
        path: `/automations/bots/${botId}`,
      } as const;
    case 'plan':
      return { to: '/plan/bots/$botId', params, path: `/plan/bots/${botId}` } as const;
    case 'pulls':
      return { to: '/pulls/bots/$botId', params, path: `/pulls/bots/${botId}` } as const;
    default:
      return { to: '/bots/$botId', params, path: `/bots/${botId}` } as const;
  }
}

/** Where a reader lands when the bot whose chat they had open in `section` is deleted. */
export const SECTION_HOME = {
  sessions: '/sessions',
  automations: '/automations',
  plan: '/plan',
  pulls: '/pulls',
} as const satisfies Record<BotSection, string>;
