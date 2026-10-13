import { Button, Input } from '@oppenheimer/design-system-web';
import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateTask } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { TASK_BLOCKED_REASON_MAX } from '@oppenheimer/shared/schemas/task';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The task dialog's Blocked row (`23-plan-milestones-stats-accounts.md` §3): a
 * task waits on a person, and says why. It saves on its own, apart from the
 * form's Save, the way the Sessions row links and unlinks: marking a task
 * blocked is a fact about it now, not an edit to the draft.
 */
export function TaskBlockedRow({ task }: { task: TaskEntity }) {
  const { t } = useTranslation();
  const update = useUpdateTask();
  const [draft, setDraft] = useState<string | null>(null);
  const save = (blockedReason: string | null) =>
    update.mutate({ id: task.id, input: { blockedReason } }, { onSuccess: () => setDraft(null) });

  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-3">
      <span className="pt-1 text-sm text-fg-muted">{t('tasks.blocked.label')}</span>
      <div className="flex min-w-0 flex-col gap-2">
        {draft !== null ? (
          <div className="flex items-center gap-2">
            <Input
              aria-label={t('tasks.blocked.reason')}
              placeholder={t('tasks.blocked.placeholder')}
              value={draft}
              maxLength={TASK_BLOCKED_REASON_MAX}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && draft.trim()) {
                  event.preventDefault();
                  save(draft.trim());
                }
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setDraft(null);
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={!draft.trim()}
              pending={update.isPending}
              pendingLabel={t('tasks.blocked.saving')}
              onClick={() => save(draft.trim())}
            >
              {t('tasks.blocked.mark')}
            </Button>
          </div>
        ) : task.isBlocked ? (
          <div className="flex min-w-0 items-start gap-2">
            <span className="min-w-0 flex-1 pt-1 text-sm text-warning [overflow-wrap:anywhere]">
              {task.blockedReason}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              pending={update.isPending}
              pendingLabel={t('tasks.blocked.saving')}
              onClick={() => save(null)}
            >
              {t('tasks.blocked.unblock')}
            </Button>
          </div>
        ) : (
          <div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft('')}>
              {t('tasks.blocked.add')}
            </Button>
          </div>
        )}
        {update.error ? (
          <ErrorAlert error={update.error} fallback={t('tasks.blocked.saveFailed')} />
        ) : null}
      </div>
    </div>
  );
}
