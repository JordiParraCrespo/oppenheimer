import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useRemoveHost } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * "Remove optimus?" as the frame draws it (`design/version1/Settings.dc.html`):
 * the title, what it costs from the host's own count, and Cancel beside
 * Remove host — no hero, no close button, so the header keeps no room for
 * one, and the frame's taller title line and 24px above the buttons. The sessions running on it are
 * stopped (their logs kept) and its runner's token is revoked
 * (`product/versions/mvp/14-hosts-settings.md`). A failure stays in the
 * dialog, where the reader still is.
 */
export function RemoveHostDialog({ host, onClose }: { host: HostEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const remove = useRemoveHost({
    onSuccess: () => {
      notifySuccess(t('toasts.hostRemoved', { name: host.name }));
      onClose();
    },
  });
  const count = host.details.runningSessionCount;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader className="pr-7">
          <DialogTitle className="leading-(--leading-body)">
            {t('hosts.settings.removeTitle', { name: host.name })}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {count > 0
              ? t('hosts.settings.removeRunning', { count, name: host.name })
              : t('hosts.settings.removeIdle', { name: host.name })}
          </DialogDescription>
        </DialogHeader>
        {remove.error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {resolveError(remove.error, t('hosts.settings.removeFailed')).message}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter className="pt-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('hosts.settings.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(host.id)}
          >
            {t('hosts.settings.remove')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
