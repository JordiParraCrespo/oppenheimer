import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { StartSessionSkeleton } from '../components/start-session-skeleton';
import { StartSessionDraft } from '../sections/start-session-draft';

/**
 * Start session for a task (`18-plan-product.md` §4), open while the address
 * says `?start=<task>` on the board or on To do; each screen reads its own
 * address and passes the task and how to close it. The session is New session's, filed under the task's
 * project and linked to it; the task moves to In progress unless it moved
 * since the click. The form reads what it needs under Suspense; this draws
 * the dialog, its placeholder and a first failure.
 */
export function StartSessionDialog({
  taskId,
  onClose,
}: {
  taskId: string | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!taskId) return null;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="lg" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('tasks.start.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="pb-6">
            <QueryState>
              <QueryState.Pending>
                <StartSessionSkeleton />
              </QueryState.Pending>
              <QueryState.Error fallback={t('tasks.start.loadFailed')} />
              <QueryState.Data>
                <StartSessionDraft taskId={taskId} onClose={onClose} />
              </QueryState.Data>
            </QueryState>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
