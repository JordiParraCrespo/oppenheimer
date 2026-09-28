import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useRemoveHost } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * "Remove optimus?" (`design/version1/Settings.dc.html`): the title, and what
 * it costs from the host's own count. The sessions running on it are stopped
 * (their logs kept) and its runner's token is revoked
 * (`product/versions/mvp/14-hosts-settings.md`).
 */
export function RemoveHostDialog({ host, onClose }: { host: HostEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const remove = useRemoveHost({ onSuccess: onClose });
  const count = host.details.runningSessionCount;

  return (
    <ConfirmDialog
      title={t('hosts.settings.removeTitle', { name: host.name })}
      description={
        count > 0
          ? t('hosts.settings.removeRunning', { count, name: host.name })
          : t('hosts.settings.removeIdle', { name: host.name })
      }
      confirmLabel={t('hosts.settings.remove')}
      pendingLabel={t('hosts.settings.removing')}
      pending={remove.isPending}
      error={remove.error}
      errorFallback={t('hosts.settings.removeFailed')}
      onClose={onClose}
      onConfirm={() => remove.mutate(host.id)}
    />
  );
}
