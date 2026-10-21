import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TaskEditorSkeleton } from '../components/task-editor-skeleton';
import { NEW_TASK } from '../lib/board-search';
import { TaskEditor } from '../sections/task-editor';

const board = getRouteApi('/_authenticated/plan/');

/**
 * New task and Edit task (`18-plan-product.md` §3), open while the address
 * says `?task=`: `new`, or a task's id, which is the link the session header's
 * "Back to task" sends. It owns the three writes; the form takes values and
 * hands them back. The editor reads under Suspense; this draws its
 * placeholder and a first failure.
 */
export function TaskDialog() {
  const { t } = useTranslation();
  const { task: open } = board.useSearch();
  const navigate = board.useNavigate();
  const close = () => navigate({ search: (previous) => ({ ...previous, task: undefined }) });
  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent size="lg" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {t(open === NEW_TASK ? 'tasks.dialog.newTitle' : 'tasks.dialog.editTitle')}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="pb-6">
            <QueryState>
              <QueryState.Pending>
                <TaskEditorSkeleton existing={open !== NEW_TASK} />
              </QueryState.Pending>
              <QueryState.Error fallback={t('tasks.dialog.loadFailed')} />
              <QueryState.Data>
                <TaskEditor taskId={open === NEW_TASK ? undefined : open} onClose={close} />
              </QueryState.Data>
            </QueryState>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
