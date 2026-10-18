import { Checkbox, FieldLabel } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useRemoveHost } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog, notifySuccess } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * "Remove optimus?" (`design/version1/Settings.dc.html`): the title, and what
 * it costs from the host's own count. The sessions running on it are stopped
 * (their logs kept) and its runner's token is revoked
 * (`product/versions/mvp/14-hosts-settings.md`).
 *
 * The box cleans the machine up as well, for starting again from nothing: the
 * runner closes every session instead of stopping it, and each worktree goes
 * without a push. It travels on the link as it closes, so an offline host
 * cannot be offered it.
 */
export function RemoveHostDialog({ host, onClose }: { host: HostEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const [wipe, setWipe] = useState(false);
  const remove = useRemoveHost({
    onSuccess: () => {
      notifySuccess('hostRemoved', { name: host.name });
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
      pendingLabel={t('hosts.settings.removing')}
      pending={remove.isPending}
      error={remove.error}
      errorFallback={t('hosts.settings.removeFailed')}
      onClose={onClose}
      onConfirm={() => remove.mutate({ id: host.id, wipe: host.online && wipe })}
    >
      <FieldLabel className="items-start">
        <Checkbox
          checked={host.online && wipe}
          onCheckedChange={(checked) => setWipe(checked === true)}
          disabled={!host.online || remove.isPending}
        />
        {host.online
          ? t('hosts.settings.wipe')
          : t('hosts.settings.wipeOffline', { name: host.name })}
      </FieldLabel>
    </ConfirmDialog>
  );
}
