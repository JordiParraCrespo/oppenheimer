import type { AutomationRunEntity } from '@oppenheimer/frontend-consumer';
import {
  useDeleteAutomation,
  useDuplicateAutomation,
  useRunAutomation,
  useSetAutomationPaused,
} from '@oppenheimer/frontend-consumer/react';
import { lastFailure } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';

/**
 * What a row menu and a page header do to an automation, in one hook so they
 * cannot drift. The surface shows the one failure the last action left, and
 * which automation, until a later success or `dismiss` clears it. Delete's
 * failure stays in its confirm dialog (`removeFailure`), never on the page as
 * well. Run now mints one idempotency key per click: a retry of that click is
 * the same run, a second click a second run.
 */
export function useAutomationActions(options: {
  onOpenRun: (run: AutomationRunEntity) => void;
  onDuplicated?: (id: string) => void;
  onDeleted?: () => void;
}) {
  const run = useRunAutomation({
    onSuccess: (started) =>
      notifySuccess(
        'runStarted',
        { name: started.automationName },
        { label: 'openRun', onClick: () => options.onOpenRun(started) },
      ),
  });
  const pause = useSetAutomationPaused({
    onSuccess: (automation) =>
      notifySuccess(automation.isPaused ? 'automationPaused' : 'automationResumed', {
        name: automation.name,
      }),
  });
  const duplicate = useDuplicateAutomation({
    onSuccess: (copy) => {
      notifySuccess('automationDuplicated', { name: copy.name });
      options.onDuplicated?.(copy.id);
    },
  });
  const remove = useDeleteAutomation();

  const failure = lastFailure([run, pause, duplicate]);
  // The automation the failed action was for: each mutation's own variables,
  // in the order the list above names them.
  const failedId = [run.variables?.id, pause.variables?.id, duplicate.variables][failure.index];

  return {
    runNow: (id: string) => run.mutate({ id, idempotencyKey: crypto.randomUUID() }),
    setPaused: (id: string, paused: boolean) => pause.mutate({ id, paused }),
    duplicate: (id: string) => duplicate.mutate(id),
    remove: (id: string, name: string) =>
      remove.mutate(id, {
        onSuccess: () => {
          notifySuccess('automationDeleted', { name });
          options.onDeleted?.();
        },
      }),
    running: run.isPending,
    removing: remove.isPending,
    removeFailure: remove.error,
    /** Clears a refused delete, so the next confirm opens clean. */
    resetRemove: () => remove.reset(),
    failure: failure.error,
    failedId,
    dismissFailure: failure.dismiss,
  };
}
