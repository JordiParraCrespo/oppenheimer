import { useCreateAutomation, useUpdateAutomation } from '@oppenheimer/frontend-consumer/react';
import { lastFailure } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';

/**
 * The editor's two writes, shared by New automation and Edit automation: a
 * save that lands toasts and hands the automation back; one that fails is
 * `failure`, which keeps the dialog open with the reason.
 */
export function useAutomationSave(onSaved: (automation: { id: string }) => void) {
  const create = useCreateAutomation({
    onSuccess: (saved) => {
      notifySuccess('automationCreated', { name: saved.name });
      onSaved(saved);
    },
  });
  const update = useUpdateAutomation({
    onSuccess: (saved) => {
      notifySuccess('automationSaved', { name: saved.name });
      onSaved(saved);
    },
  });
  return {
    create,
    update,
    saving: create.isPending || update.isPending,
    failure: lastFailure([create, update]).error,
  };
}
