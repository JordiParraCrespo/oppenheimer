import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { usePutSessionShare } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ShareSessionPanes } from '../sections/share-session-panes';

/**
 * Share a session (`ShareSession.dc.html`, and the Share dialog of
 * `SessionsConsole (pages).dc.html`), from the terminal's status line or a
 * session row's menu. The panes read the session and its share under
 * Suspense; this draws the dialog, its placeholder and a first failure, and
 * owns the write, so Close waits while a share is being saved.
 */
export function ShareSessionDialog({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const put = usePutSessionShare();
  const header = (
    <DialogHeader>
      <DialogTitle>{t('sessions.share.title')}</DialogTitle>
    </DialogHeader>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && !put.isPending && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <QueryState>
          <QueryState.Pending>
            {header}
            <DialogBody>
              <Skeleton className="h-64 w-full" />
            </DialogBody>
          </QueryState.Pending>
          <QueryState.Error>
            {(error, retry) => (
              <>
                {header}
                <DialogBody>
                  <ErrorAlert
                    error={error}
                    fallback={t('sessions.share.loadFailed')}
                    action={
                      <Button variant="ghost" size="sm" onClick={retry}>
                        {t('common.retry')}
                      </Button>
                    }
                  />
                </DialogBody>
              </>
            )}
          </QueryState.Error>
          <QueryState.Data>
            <ShareSessionPanes sessionId={sessionId} put={put} onClose={onClose} />
          </QueryState.Data>
        </QueryState>
      </DialogContent>
    </Dialog>
  );
}
