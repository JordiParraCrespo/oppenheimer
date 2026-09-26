import {
  Button,
  EmptyState,
  HostCard,
  SettingsTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Settings → Hosts (`design/version1/Settings.dc.html`): the title and its
 * line, Add host on the right, then a card per machine. The rows the export
 * draws on a card — rename, remove, the install command, the preflight — are
 * the hosts slice's (`product/versions/mvp/05-screens.md`); this is the page
 * they land on.
 */
export function HostsSettingsScreen() {
  const { t } = useTranslation();
  const hosts = useHosts();

  return (
    <>
      <SettingsTitle
        title={t('settings.hosts.title')}
        description={t('settings.hosts.description')}
        action={
          <Button render={<Link to="/settings/hosts/new" />}>
            <Plus />
            {t('settings.hosts.add')}
          </Button>
        }
      />

      {hosts.isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : hosts.data?.length ? (
        <div className="flex flex-col gap-3">
          {hosts.data.map((host) => (
            <HostCard
              key={host.id}
              name={host.name}
              meta={host.os ?? undefined}
              status={host.online ? 'idle' : 'offline'}
              state={host.online ? t('settings.hosts.online') : t('settings.hosts.offline')}
            />
          ))}
        </div>
      ) : (
        <EmptyState compact>
          <EmptyState.Header>
            <EmptyState.Title>{t('settings.hosts.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('settings.hosts.emptyHint')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      )}
    </>
  );
}
