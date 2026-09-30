import {
  SettingsNav,
  SettingsNavBack,
  SettingsNavGroup,
  SettingsNavItem,
} from '@oppenheimer/design-system-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavTo, SettingsNavGroupConfig } from '../lib/nav';

/**
 * The Settings pages' sidebar: Back to console, then the groups the app
 * declares (Account, Workspace), each row a link with an icon.
 *
 * Kit because it knows nothing of what a row counts: a count is the
 * `renderCount` slot, answered by a section that reads the product hook, so a
 * refetch re-renders the number and not this sidebar. A row is active on its
 * destination only (the router's answer); a page beneath it (Add a host under
 * Hosts) leaves it unlit, as the frame draws it.
 */
export function SettingsSidebar({
  groups,
  back,
  renderCount,
}: {
  groups: readonly SettingsNavGroupConfig[];
  /** Where Back to console goes. */
  back: NavTo;
  /** The count a row carries, if any: an element the app renders for that destination. */
  renderCount?: (to: NavTo) => ReactNode;
}) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  return (
    <SettingsNav>
      <SettingsNavBack render={<Link to={back} />}>{t('settings.nav.back')}</SettingsNavBack>
      {groups.map((group) => (
        <SettingsNavGroup key={group.labelKey} label={t(`settings.nav.${group.labelKey}`)}>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = Boolean(matchRoute({ to: item.to }));
            return (
              <SettingsNavItem
                key={item.to}
                icon={<Icon />}
                count={renderCount?.(item.to)}
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
