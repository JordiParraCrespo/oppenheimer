import type { BotSection } from '@oppenheimer/shared/schemas/bot';

/** Each console section by the name the rail gives it. */
export const SECTION_NAMES = {
  sessions: 'nav.sessions',
  automations: 'nav.automations',
  plan: 'nav.plan',
  pulls: 'nav.pullRequests',
} as const satisfies Record<BotSection, string>;
