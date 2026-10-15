import { Bot, Database, FileText, Terminal } from '@oppenheimer/design-system-web/icons';

/**
 * A bot's settings pages in the design's order, each its own route under
 * `/bots/$botId/settings/`. Slice 1 has these four; Access, Approvals,
 * Teammates, Routines and Notifications arrive with what they configure.
 */
export const BOT_SETTINGS_TABS = [
  {
    slug: 'profile',
    to: '/bots/$botId/settings/profile',
    labelKey: 'bots.settings.tabs.profile',
    Icon: Bot,
  },
  {
    slug: 'instructions',
    to: '/bots/$botId/settings/instructions',
    labelKey: 'bots.settings.tabs.instructions',
    Icon: FileText,
  },
  {
    slug: 'memory',
    to: '/bots/$botId/settings/memory',
    labelKey: 'bots.settings.tabs.memory',
    Icon: Database,
  },
  {
    slug: 'runs-on',
    to: '/bots/$botId/settings/runs-on',
    labelKey: 'bots.settings.tabs.runsOn',
    Icon: Terminal,
  },
] as const;
