import {
  useDeleteAutomation,
  useDuplicateAutomation,
  useRunAutomation,
  useSetAutomationPaused,
} from '@oppenheimer/frontend-consumer/react';
import { lastFailure } from '@oppenheimer/frontend-core/react';

/**
 * What a row menu and a page header do to an automation: Run now, pause or
 * resume, duplicate, delete. One hook for both so they cannot drift, and so
 * the surface shows the one failure the last action left — and which
 * automation it was, so a list can name it. A later action that succeeds
 * clears it, and `dismiss` does too.
 *
 * Run now mints one idempotency key per click: a retried request of that
 * click is the same run, and a second click is a second run.
 */
export function useAutomationActions(options?: {
  onDuplicated?: (id: string) => void;
  onDeleted?: () => void;
}) {
  const run = useRunAutomation();
  const pause = useSetAutomationPaused();
  const duplicate = useDuplicateAutomation({
    onSuccess: (copy) => options?.onDuplicated?.(copy.id),
  });
  const remove = useDeleteAutomation({ onSuccess: () => options?.onDeleted?.() });

  const failure = lastFailure([run, pause, duplicate, remove]);
  // The automation the failed action was for: each mutation's own variables,
  // in the order the list above names them.
  const failedId = [run.variables?.id, pause.variables?.id, duplicate.variables, remove.variables][
    failure.index
  ];

  return {
    runNow: (id: string) => run.mutate({ id, idempotencyKey: crypto.randomUUID() }),
    setPaused: (id: string, paused: boolean) => pause.mutate({ id, paused }),
    duplicate: (id: string) => duplicate.mutate(id),
    remove: (id: string) => remove.mutate(id),
    running: run.isPending,
    failure: failure.error,
    failedId,
    dismissFailure: failure.dismiss,
  };
}
