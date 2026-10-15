import { useSuspenseAutomation } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';
import { useAutomationSave } from '../hooks/use-automation-save';
import { draftOf, toUpdateInput } from '../lib/automation-draft';
import { AutomationEditor } from './automation-editor';

/**
 * Edit automation, in `AutomationEditorDialog`'s `QueryState.Data`: the
 * automation read under Suspense seeds the draft once, then the editor owns
 * it. A refetch that fails keeps the editor and says so above it.
 */
export function EditAutomation({
  automationId,
  onClose,
  onSaved,
}: {
  automationId: string;
  onClose: () => void;
  onSaved: (automation: { id: string }) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  // A refetch that fails is not drawn here: the editor's draft was seeded once.
  const { data: automation } = useSuspenseAutomation(automationId);
  const { update, saving, failure } = useAutomationSave(onSaved);

  return (
    <AutomationEditor
      initialDraft={draftOf(automation)}
      initialTask={{ name: automation.name, prompt: automation.revision.prompt }}
      editing
      saving={saving}
      failure={failure ? resolveError(failure, t('automations.editor.saveFailed')) : null}
      onCancel={onClose}
      onSubmit={(draft, task) => {
        const input = toUpdateInput(draft, task, automation.version);
        if (input) update.mutate({ id: automation.id, input });
      }}
    />
  );
}
