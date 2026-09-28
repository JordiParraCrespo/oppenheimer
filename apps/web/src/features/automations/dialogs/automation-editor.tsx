import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import {
  useAutomation,
  useCreateAutomation,
  useHosts,
  useProjects,
  useUpdateAutomation,
} from '@oppenheimer/frontend-consumer/react';
import { lastFailure, useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { draftOf, emptyDraft, toCreateInput, toUpdateInput } from '../lib/automation-draft';
import { AutomationEditor } from '../sections/automation-editor';

/**
 * New automation and Edit automation (`product/versions/mvp/13-automations.md`):
 * a dialog over the console, opened from the sidebar's button, a project
 * header's plus, the overview's button, a row's Edit and a page's Edit.
 *
 * It waits for what the editor starts from — the automation being edited,
 * or the projects and hosts a new one is prefilled from — so the draft is
 * seeded once, then owns the save. A save that fails keeps the dialog open
 * with the reason; one that lands closes it.
 */
export function AutomationEditorDialog({
  automationId,
  projectId,
  onClose,
  onSaved,
}: {
  /** Present edits this automation; absent creates one. */
  automationId?: string;
  /** The project a header's plus opened it for. */
  projectId?: string;
  onClose: () => void;
  onSaved: (automation: { id: string }) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const existing = useAutomation(automationId);
  const projects = useProjects();
  const hosts = useHosts();
  const create = useCreateAutomation({
    onSuccess: (saved) => {
      notifySuccess(t('toasts.automationCreated', { name: saved.name }));
      onSaved(saved);
    },
  });
  const update = useUpdateAutomation({
    onSuccess: (saved) => {
      notifySuccess(t('toasts.automationSaved', { name: saved.name }));
      onSaved(saved);
    },
  });
  const editing = Boolean(automationId);
  const failure = lastFailure([create, update]).error;

  const ready = editing ? Boolean(existing.data) : Boolean(projects.data && hosts.data);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" closeLabel={t('common.close')}>
        {ready ? (
          <AutomationEditor
            initialDraft={
              existing.data
                ? draftOf(existing.data)
                : emptyDraft(projects.data ?? [], hosts.data ?? [], projectId)
            }
            initialTask={
              existing.data
                ? { name: existing.data.name, prompt: existing.data.revision.prompt }
                : { name: '', prompt: '' }
            }
            editing={editing}
            saving={create.isPending || update.isPending}
            failure={failure ? resolveError(failure, t('automations.editor.saveFailed')) : null}
            onCancel={onClose}
            onSubmit={(draft, task) => {
              if (existing.data) {
                const input = toUpdateInput(draft, task, existing.data.version);
                if (input) update.mutate({ id: existing.data.id, input });
              } else {
                const input = toCreateInput(draft, task);
                if (input) create.mutate(input);
              }
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {editing ? t('automations.editor.editTitle') : t('automations.editor.newTitle')}
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
