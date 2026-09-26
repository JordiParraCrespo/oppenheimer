import {
  SettingsNav,
  SettingsNavBack,
  SettingsNavGroup,
  SettingsNavItem,
} from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The Settings frame's left side: back to the console, then the Workspace
 * group with Hosts and its count. The frame's Account group (Profile) is not
 * drawn: there is no Profile page yet. Only the count subscribes to the list,
 * narrowed to a number.
 */
export function HostsSettingsNav() {
  const { t } = useTranslation();
  const count = useHosts({ select: (hosts) => hosts.length });
  // The frame lights Hosts on the list, not while Add a host is open over it.
  const onHosts = useRouterState({
    select: (state) => state.location.pathname.replace(/\/$/, '') === '/settings/hosts',
  });

  return (
    <SettingsNav aria-label={t('nav.settings')}>
      <SettingsNavBack render={<Link to="/sessions" />}>{t('nav.backToConsole')}</SettingsNavBack>
      <SettingsNavGroup label={t('nav.workspace')}>
        <SettingsNavItem
          icon={<Cpu />}
          count={count.data}
          active={onHosts}
          render={<Link to="/settings/hosts" />}
        >
          {t('nav.hosts')}
        </SettingsNavItem>
      </SettingsNavGroup>
    </SettingsNav>
  );
}
