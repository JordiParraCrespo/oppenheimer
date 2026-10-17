import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { StartSessionDraft } from '../sections/start-session-draft';

const board = getRouteApi('/_authenticated/plan/');

/**
 * Start session for a task (`18-plan-product.md` §4), open while the address
 * says `?start=<task>`. The session is New session's, filed under the task's
 * project and linked to it; the task moves to In progress unless it moved
 * since the click. The form reads what it needs under Suspense; this draws
 * the dialog, its placeholder and a first failure.
 */
export function StartSessionDialog() {
  const { t } = useTranslation();
  const { start } = board.useSearch();
  const navigate = board.useNavigate();
  const close = () => navigate({ search: (previous) => ({ ...previous, start: undefined }) });
  if (!start) return null;

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent size="lg" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('tasks.start.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="pb-6">
            <QueryState>
              <QueryState.Pending>
                <Skeleton className="h-40 w-full" />
              </QueryState.Pending>
              <QueryState.Error fallback={t('tasks.start.loadFailed')} />
              <QueryState.Data>
                <StartSessionDraft />
              </QueryState.Data>
            </QueryState>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
