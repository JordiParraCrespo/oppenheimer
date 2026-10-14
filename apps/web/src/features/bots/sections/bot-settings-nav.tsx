import { SettingsNav, SettingsNavItem } from '@oppenheimer/design-system-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BOT_SETTINGS_TABS } from '@/features/bots/lib/settings-tabs';

/**
 * A bot's settings pages as the design's left list: one row per page, the
 * current one lit. It reads only which page the address is on, so moving
 * between pages re-renders this list and not the bar above it.
 */
export function BotSettingsNav({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const current = useRouterState({
    select: (state) => state.location.pathname.split('/settings/')[1]?.split('/')[0],
  });

  return (
    <SettingsNav aria-label={t('bots.settings.navLabel')}>
      {BOT_SETTINGS_TABS.map((tab) => (
        <SettingsNavItem
          key={tab.slug}
          icon={<tab.Icon />}
          active={current === tab.slug}
          aria-current={current === tab.slug ? 'page' : undefined}
          render={<Link to={tab.to} params={{ botId }} />}
        >
          {t(tab.labelKey)}
        </SettingsNavItem>
      ))}
    </SettingsNav>
  );
}
