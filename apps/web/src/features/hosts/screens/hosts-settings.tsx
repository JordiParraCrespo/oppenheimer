import {
  Alert,
  AlertDescription,
  Button,
  EmptyState,
  HostCard,
  SettingsTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Settings → Hosts (`design/version1/Settings.dc.html`): the title and its
 * line, Add host on the right — the console's one pairing page, opened from
 * here — then a card per machine. The card says what the control plane
 * says, that the runner is up or not; the rows the export draws on it —
 * rename, remove, the install command, the preflight — are the hosts slice's
 * (`product/versions/mvp/05-screens.md`).
 */
export function HostsSettingsScreen() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const hosts = useHosts();

  return (
    <>
      <SettingsTitle
        title={t('settings.hosts.title')}
        description={t('settings.hosts.description')}
        action={
          <Button render={<Link to="/hosts/new" search={{ from: 'settings' }} />}>
            <Plus />
            {t('settings.hosts.add')}
          </Button>
        }
      />

      {hosts.isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : hosts.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(hosts.error, t('settings.hosts.failed')).message}
          </AlertDescription>
        </Alert>
      ) : hosts.data.length ? (
        <div className="flex flex-col gap-3">
          {hosts.data.map((host) => (
            <HostCard
              key={host.id}
              name={host.name}
              meta={host.os ?? undefined}
              status={host.online ? 'connected' : 'offline'}
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
