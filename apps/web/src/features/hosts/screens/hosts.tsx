import { Button } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HostList } from '../sections/host-list';

/**
 * Settings → Hosts (`design/version1/Settings.dc.html`): the machines a
 * person has paired, each with its status and running sessions, renamed,
 * copied or removed in place; Add host is the page main already has.
 */
export function HostsScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-end gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="m-0 text-[28px] font-semibold tracking-[-0.02em] text-fg">
            {t('hosts.settings.title')}
          </h1>
          <p className="m-0 text-sm text-fg-muted">{t('hosts.settings.description')}</p>
        </div>
        <Button render={<Link to="/hosts/new" />}>
          <Plus />
          {t('hosts.settings.add')}
        </Button>
      </div>
      <HostList />
    </div>
  );
}
