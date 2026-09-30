import type { AutomationRunEntity } from '@oppenheimer/frontend-consumer';
import {
  useDeleteAutomation,
  useDuplicateAutomation,
  useRunAutomation,
  useSetAutomationPaused,
} from '@oppenheimer/frontend-consumer/react';
import { lastFailure } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { useRef } from 'react';

/**
 * What a row menu and a page header do to an automation: Run now, pause or
 * resume, duplicate, delete. One hook for both so they cannot drift, and so
 * the surface shows the one failure the last action left — and which
 * automation it was, so a list can name it. A later action that succeeds
 * clears it, and `dismiss` does too.
 *
 * Delete is the exception: it goes through a confirm, and its failure stays
 * in that dialog (`removeFailure`), never on the page as well. Its toast and
 * `onDeleted` hang on the mutation, not on the `mutate` call: the delete's
 * cache update refetches the open detail page into a 404, which unmounts the
 * header that asked, and a per-call callback does not fire once it has.
 *
 * Each action toasts when it lands, with the name its response carries; the
 * delete's is the one the confirm already holds. Where Run now's Open leads
 * is the caller's (`onOpenRun`).
 *
 * Run now mints one idempotency key per click: a retried request of that
 * click is the same run, and a second click is a second run.
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
  // The name the confirm holds, for the toast of the delete it started.
  const removingName = useRef('');
  const remove = useDeleteAutomation({
    onSuccess: () => {
      notifySuccess('automationDeleted', { name: removingName.current });
      options.onDeleted?.();
    },
  });

  const failure = lastFailure([run, pause, duplicate]);
  // The automation the failed action was for: each mutation's own variables,
  // in the order the list above names them.
  const failedId = [run.variables?.id, pause.variables?.id, duplicate.variables][failure.index];

  return {
    runNow: (id: string) => run.mutate({ id, idempotencyKey: crypto.randomUUID() }),
    setPaused: (id: string, paused: boolean) => pause.mutate({ id, paused }),
    duplicate: (id: string) => duplicate.mutate(id),
    remove: (id: string, name: string) => {
      removingName.current = name;
      remove.mutate(id);
    },
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
