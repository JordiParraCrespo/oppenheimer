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
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCloseSession } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';

/**
 * Delete a session, from the row's menu.
 *
 * "Delete" is the console's word for the API's close: the session stops,
 * its worktree leaves the host, the transcript is gone, and the row stays
 * resolved so its directory name and branch are never reissued — which is
 * why the list drops it rather than the API. The dialog owns the mutation;
 * a failure stays on screen next to the button, never a toast.
 */
export function DeleteSessionDialog({
  session,
  onClose,
}: {
  session: SessionEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const close = useCloseSession({ onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-105">
        <DialogHeader>
          <DialogTitle>{t('sessions.deleteSession.title', { name: session.name })}</DialogTitle>
          <DialogDescription>{t('sessions.deleteSession.description')}</DialogDescription>
        </DialogHeader>
        {close.isError ? (
          <Alert variant="destructive" className="mx-7">
            <AlertDescription>
              {resolveError(close.error, t('sessions.deleteSession.failed')).message}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={close.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={close.isPending}
            onClick={() => close.mutate({ id: session.id })}
          >
            {close.isPending
              ? t('sessions.deleteSession.deleting')
              : t('sessions.deleteSession.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
