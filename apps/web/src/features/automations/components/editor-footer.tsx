import { Button, DialogFooter } from '@oppenheimer/design-system-web';
import type { AutomationTaskDto } from '@oppenheimer/shared/schemas/automation';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useTaskGap } from '../hooks/use-task-done';
import { EDITOR_STEPS, type EditorStep } from './editor-steps';

/**
 * The editor's foot: on the left, the one thing still missing ("Add a
 * trigger."); on the right Cancel or Back, then Next, or Save / Create on the
 * last step. Next is off while the open step is incomplete.
 */
export function EditorFooter({
  step,
  control,
  triggerDone,
  whereDone,
  editing,
  saving,
  onStepChange,
  onCancel,
}: {
  step: EditorStep;
  control: Control<AutomationTaskDto>;
  triggerDone: boolean;
  whereDone: boolean;
  editing: boolean;
  saving: boolean;
  onStepChange: (step: EditorStep) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const taskGap = useTaskGap(control);
  const index = EDITOR_STEPS.indexOf(step);
  const stepDone =
    step === 'task' ? taskGap === null : step === 'trigger' ? triggerDone : whereDone;
  const missing =
    taskGap === 'name'
      ? t('automations.editor.missingName')
      : taskGap === 'prompt'
        ? t('automations.editor.missingPrompt')
        : !triggerDone
          ? t('automations.editor.missingTrigger')
          : !whereDone
            ? t('automations.editor.missingWhere')
            : '';
  const ready = taskGap === null && triggerDone && whereDone;

  return (
    <DialogFooter className="items-center">
      <span className="min-w-0 flex-1 text-[12.5px] text-pretty text-fg-muted">{missing}</span>
      {index > 0 ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => onStepChange(EDITOR_STEPS[index - 1])}
        >
          {t('automations.editor.back')}
        </Button>
      ) : (
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      )}
      {index < EDITOR_STEPS.length - 1 ? (
        <Button
          type="button"
          disabled={!stepDone}
          onClick={() => onStepChange(EDITOR_STEPS[index + 1])}
        >
          {t('automations.editor.next')}
        </Button>
      ) : (
        <Button type="submit" disabled={!ready || saving}>
          {editing ? t('automations.editor.save') : t('automations.editor.create')}
        </Button>
      )}
    </DialogFooter>
  );
}
