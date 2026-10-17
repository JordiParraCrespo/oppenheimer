import { useSuspenseNewAutomation } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';
import { useAutomationSave } from '../hooks/use-automation-save';
import { emptyDraft, toCreateInput } from '../lib/automation-draft';
import { AutomationEditor } from './automation-editor';

/**
 * New automation, in `AutomationEditorDialog`'s `QueryState.Data`: the
 * projects and hosts read under Suspense prefill the draft once (on
 * `projectId` when the opener named one), then the editor owns it. The draft is
 * seeded once, so a later read changes nothing the editor shows.
 */
export function NewAutomation({
  projectId,
  onClose,
  onSaved,
}: {
  projectId?: string;
  onClose: () => void;
  onSaved: (automation: { id: string }) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  // A refetch that fails is not drawn here: the editor's draft was seeded once.
  const { projects, hosts } = useSuspenseNewAutomation();
  const { create, saving, failure } = useAutomationSave(onSaved);

  return (
    <AutomationEditor
      initialDraft={emptyDraft(projects, hosts, projectId)}
      initialTask={{ name: '', prompt: '' }}
      editing={false}
      saving={saving}
      failure={failure ? resolveError(failure, t('automations.editor.saveFailed')) : null}
      onCancel={onClose}
      onSubmit={(draft, task) => {
        const input = toCreateInput(draft, task);
        if (input) create.mutate(input);
      }}
    />
  );
}
