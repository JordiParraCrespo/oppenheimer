import type { AutomationRunEntity } from '@oppenheimer/frontend-consumer';
import {
  useDeleteAutomation,
  useDuplicateAutomation,
  useRunAutomation,
  useSetAutomationPaused,
} from '@oppenheimer/frontend-consumer/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/** What an action needs to know about the automation it acts on. */
interface Target {
  id: string;
  name: string;
}

/**
 * What a row menu and a page header do to an automation: Run now, pause or
 * resume, duplicate, delete. One hook for both so they cannot drift, and so
 * the surface shows the one failure the last action left.
 *
 * Every action toasts when it lands: the table's row changes somewhere in a
 * long list, and duplicate and delete leave the page they started on. Run now
 * starts work nothing on screen shows, so its toast opens the run.
 *
 * Run now mints one idempotency key per click: a retried request of that
 * click is the same run, and a second click is a second run.
 */
export function useAutomationActions(options?: {
  onDuplicated?: (id: string) => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Run, pause and duplicate answer with the automation's name, so their
  // toasts sit on the hook and a second click before the first lands still
  // gets its own. Delete answers with nothing; one at a time goes through a
  // confirm, so its toast rides the call.
  const run = useRunAutomation({
    onSuccess: (started) =>
      notifySuccess(t('toasts.runStarted', { name: started.automationName }), {
        label: t('toasts.openRun'),
        onClick: () => openRun(started),
      }),
  });
  const pause = useSetAutomationPaused({
    onSuccess: (automation) =>
      notifySuccess(
        t(automation.isPaused ? 'toasts.automationPaused' : 'toasts.automationResumed', {
          name: automation.name,
        }),
      ),
  });
  const duplicate = useDuplicateAutomation({
    onSuccess: (copy) => {
      notifySuccess(t('toasts.automationDuplicated', { name: copy.name }));
      options?.onDuplicated?.(copy.id);
    },
  });
  const remove = useDeleteAutomation();

  const failure = run.error ?? pause.error ?? duplicate.error ?? remove.error;

  // The run's session, once it has one; the Runs tab while it is still queued.
  function openRun(started: AutomationRunEntity) {
    if (started.sessionId) {
      navigate({
        to: '/automations/$automationId/sessions/$sessionId',
        params: { automationId: started.automationId, sessionId: started.sessionId },
      });
    } else {
      navigate({ to: '/automations/runs' });
    }
  }

  return {
    runNow: (automation: Target) =>
      run.mutate({ id: automation.id, idempotencyKey: crypto.randomUUID() }),
    setPaused: (automation: Target, paused: boolean) => pause.mutate({ id: automation.id, paused }),
    duplicate: (automation: Target) => duplicate.mutate(automation.id),
    remove: (automation: Target) =>
      remove.mutate(automation.id, {
        onSuccess: () => {
          notifySuccess(t('toasts.automationDeleted', { name: automation.name }));
          options?.onDeleted?.();
        },
      }),
    running: run.isPending,
    removing: remove.isPending,
    removeFailure: remove.error,
    failure,
  };
}
