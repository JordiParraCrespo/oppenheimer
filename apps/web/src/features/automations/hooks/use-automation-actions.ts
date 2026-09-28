import {
  useDeleteAutomation,
  useDuplicateAutomation,
  useRunAutomation,
  useSetAutomationPaused,
} from '@oppenheimer/frontend-consumer/react';

/**
 * What a row menu and a page header do to an automation: Run now, pause or
 * resume, duplicate, delete. One hook for both so they cannot drift, and so
 * the surface shows the one failure the last action left.
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

  const failure = run.error ?? pause.error ?? duplicate.error ?? remove.error;

  return {
    runNow: (id: string) => run.mutate({ id, idempotencyKey: crypto.randomUUID() }),
    setPaused: (id: string, paused: boolean) => pause.mutate({ id, paused }),
    duplicate: (id: string) => duplicate.mutate(id),
    remove: (id: string) => remove.mutate(id),
    running: run.isPending,
    failure,
  };
}
