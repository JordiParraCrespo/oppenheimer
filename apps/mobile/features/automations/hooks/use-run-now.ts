import { useRunAutomation } from '@oppenheimer/frontend-consumer/react';
import { useEffect } from 'react';

/** How long "Run started" stands on the button before it reads Run now again. */
const STARTED_MS = 3000;

/**
 * Run now for one automation: one key per tap, so a retried request is the
 * same run, not a second one. `started` is true for a few seconds after a run
 * starts, then the button reads Run now again; a new tap or a failure ends it
 * at once.
 */
export function useRunNow(automationId: string) {
  const run = useRunAutomation();
  const { isSuccess, reset } = run;

  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(reset, STARTED_MS);
    return () => clearTimeout(timer);
  }, [isSuccess, reset]);

  return {
    start: () => run.mutate({ id: automationId, idempotencyKey: crypto.randomUUID() }),
    pending: run.isPending,
    started: isSuccess,
    failed: run.isError,
  };
}
