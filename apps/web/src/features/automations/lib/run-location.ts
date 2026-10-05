import type { AutomationRunEntity } from '@oppenheimer/frontend-consumer';

/**
 * Where a started run opens: the session it started, beside the automations
 * list, or the Runs tab while it is still queued and has no session yet.
 */
export function runLocation(run: Pick<AutomationRunEntity, 'automationId' | 'sessionId'>) {
  return run.sessionId
    ? {
        to: '/automations/$automationId/sessions/$sessionId' as const,
        params: { automationId: run.automationId, sessionId: run.sessionId },
      }
    : { to: '/automations/runs' as const };
}
