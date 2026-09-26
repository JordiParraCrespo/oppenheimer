import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldLabel,
} from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCloseSession } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Delete a session, from the row's menu.
 *
 * "Delete" is the console's word for the API's close: the session stops,
 * its worktree leaves the host, the transcript is gone, and the row stays
 * resolved so its directory name and branch are never reissued — which is
 * why the list drops it rather than the API.
 *
 * The close refuses a worktree with work that is not pushed unless the
 * caller accepts losing it, and this dialog is where that is accepted: a
 * sentence and a box, not a hidden flag. Unticked, the copy says the delete
 * stops on such work, so a refusal is the expected answer rather than a
 * surprise. The dialog owns the mutation; a failure stays on screen next to
 * the button, never a toast.
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
  const [discard, setDiscard] = useState(false);
  const close = useCloseSession({ onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-105">
        <DialogHeader>
          <DialogTitle>{t('sessions.deleteSession.title', { name: session.name })}</DialogTitle>
          <DialogDescription>
            {t('sessions.deleteSession.description')} {t('sessions.deleteSession.keeps')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-7">
          <FieldLabel className="flex items-center gap-2.5">
            <Checkbox
              checked={discard}
              onCheckedChange={(checked) => setDiscard(checked === true)}
              disabled={close.isPending}
            />
            {t('sessions.deleteSession.discard')}
          </FieldLabel>
          {close.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {resolveError(close.error, t('sessions.deleteSession.failed')).message}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={close.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={close.isPending}
            onClick={() => close.mutate({ id: session.id, acceptUnpushedWork: discard })}
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
