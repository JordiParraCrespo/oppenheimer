import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useSetHostSessionLimit } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, notifySuccess } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { SessionLimitForm } from '../forms/session-limit';

/**
 * How many sessions may run on a host at once. A gate on what starts next:
 * lowering it below what is running stops nothing, and the next start is
 * refused until one stops (`SESSIONS_021`).
 */
export function SessionLimitDialog({ host, onClose }: { host: HostEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const limit = useSetHostSessionLimit({
    onSuccess: (updated) => {
      notifySuccess('hostSessionLimitChanged', { name: updated.name });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-105">
        <DialogHeader>
          <DialogTitle>{t('hosts.settings.sessionLimit.title', { name: host.name })}</DialogTitle>
          <DialogDescription>{t('hosts.settings.sessionLimit.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert error={limit.error} fallback={t('hosts.settings.sessionLimit.failed')} />
            <SessionLimitForm
              maxSessions={host.details.maxSessions}
              sessionLimit={host.details.sessionLimit}
              pending={limit.isPending}
              onSubmit={(maxSessions) => limit.mutate({ id: host.id, maxSessions })}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
