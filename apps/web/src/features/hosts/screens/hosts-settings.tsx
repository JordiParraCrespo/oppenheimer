import { Button, SettingsTitle } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HostList } from '../sections/host-list';

/**
 * Settings → Hosts (`design/version1/Settings.dc.html`): the title and its
 * line, Add host on the right — the console's one pairing page, opened from
 * here — then a card per machine with its status and running sessions,
 * renamed, copied or removed in place.
 */
export function HostsSettingsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle
        title={t('settings.hosts.title')}
        description={t('settings.hosts.description')}
        action={
          <Button render={<Link to="/hosts/new" search={{ from: 'settings' }} />}>
            <Plus className="size-3.75" />
            {t('settings.hosts.add')}
          </Button>
        }
      />
      <HostList />
    </>
  );
}
