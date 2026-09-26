import {
  SettingsNav,
  SettingsNavBack,
  SettingsNavGroup,
  SettingsNavItem,
} from '@oppenheimer/design-system-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { NavTo, SettingsNavGroupConfig } from '../lib/nav';

/**
 * The Settings pages' sidebar: Back to console, then the groups the app
 * declares (Account, Workspace), each row a link with an icon and, where the
 * app hands one, a count.
 *
 * Kit rather than feature because it is chrome: it knows nothing of what a
 * row counts. The app passes the count as an element — a section that reads
 * the product hook — so a refetch of that list re-renders the count and not
 * this sidebar. Which row is current is read off the route: a row is active
 * while the pathname is under its destination, so a page beneath it (Add a
 * host under Hosts) keeps its parent lit.
 */
export function SettingsSidebar({
  groups,
  back,
}: {
  groups: readonly SettingsNavGroupConfig[];
  /** Where Back to console goes. */
  back: NavTo;
}) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <SettingsNav>
      <SettingsNavBack render={<Link to={back} />}>{t('settings.nav.back')}</SettingsNavBack>
      {groups.map((group) => (
        <SettingsNavGroup key={group.labelKey} label={t(`settings.nav.${group.labelKey}`)}>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <SettingsNavItem
                key={item.to}
                icon={<Icon />}
                count={item.count}
                active={active}
                aria-current={active ? 'page' : undefined}
                render={<Link to={item.to} />}
              >
                {t(`settings.nav.${item.labelKey}`)}
              </SettingsNavItem>
            );
          })}
        </SettingsNavGroup>
      ))}
    </SettingsNav>
  );
}
