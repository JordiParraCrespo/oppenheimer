import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateHostRunner } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, notifySuccess } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * "Update the runner on optimus?": what the update does to the host before it
 * is sent. The runner restarts on the newest release on its channel; sessions
 * live in tmux and keep running, and open terminals reconnect
 * (`product/versions/mvp/09-runner-install-and-update.md` §5). A refusal — the
 * host went offline in between — stays in the dialog.
 */
export function UpdateRunnerDialog({ host, onClose }: { host: HostEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateHostRunner({
    onSuccess: () => {
      notifySuccess('hostUpdateRequested', { name: host.name });
      onClose();
    },
  });

  return (
    <ConfirmDialog
      tone="primary"
      title={t('hosts.settings.updateTitle', { name: host.name })}
      description={t('hosts.settings.updateDescription', { name: host.name })}
      confirmLabel={t('hosts.settings.updateRunner')}
      pendingLabel={t('hosts.settings.updating')}
      pending={update.isPending}
      error={update.error}
      errorFallback={t('hosts.settings.updateFailed', { name: host.name })}
      onClose={onClose}
      onConfirm={() => update.mutate(host.id)}
    />
  );
}
