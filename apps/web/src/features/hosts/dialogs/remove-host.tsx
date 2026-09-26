import { toast } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useRemoveHost } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * "Remove optimus?" — and what it costs, from the host's own count: the
 * sessions running on it are stopped (their logs kept), and its runner's
 * token is revoked (`product/versions/mvp/13-hosts-settings.md`). The failure
 * stays in the dialog, where the reader still is.
 */
export function RemoveHostDialog({ host, onClose }: { host: HostEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const remove = useRemoveHost({
    onSuccess: () => {
      toast.success(t('hosts.settings.removed'));
      onClose();
    },
  });
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
      pending={remove.isPending}
      error={remove.error}
      onClose={onClose}
      onConfirm={() => remove.mutate(host.id)}
    />
  );
}
