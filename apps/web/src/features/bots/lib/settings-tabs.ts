import {
  Bot,
  Database,
  FileText,
  ShieldCheck,
  SquareSlash,
  Terminal,
  Zap,
} from '@oppenheimer/design-system-web/icons';

/**
 * A bot's settings pages in the design's order, each its own route under
 * `/bots/$botId/settings/`. Teammates and Notifications arrive with what
 * they configure.
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
    slug: 'skills',
    to: '/bots/$botId/settings/skills',
    labelKey: 'bots.settings.tabs.skills',
    Icon: SquareSlash,
  },
  {
    slug: 'permissions',
    to: '/bots/$botId/settings/permissions',
    labelKey: 'bots.settings.tabs.permissions',
    Icon: ShieldCheck,
  },
  {
    slug: 'routines',
    to: '/bots/$botId/settings/routines',
    labelKey: 'bots.settings.tabs.routines',
    Icon: Zap,
  },
  {
    slug: 'home-host',
    to: '/bots/$botId/settings/home-host',
    labelKey: 'bots.settings.tabs.homeHost',
    Icon: Terminal,
  },
] as const;
