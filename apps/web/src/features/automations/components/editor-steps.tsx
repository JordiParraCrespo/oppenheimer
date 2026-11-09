import type { AutomationTaskDto } from '@oppenheimer/shared/schemas/automation';
import type { Control } from 'react-hook-form';
import { useTaskGap } from '../hooks/use-task-done';
import { type EditorStep, EditorStepTabs } from './editor-step-tabs';

export { EDITOR_STEPS, type EditorStep } from './editor-step-tabs';

/**
 * The editor's step tabs on the form: whether the Task step is done is read
 * here, at the leaf, so typing re-renders the tabs and not the editor.
 */
export function EditorSteps({
  step,
  control,
  triggerDone,
  whereDone,
  onStepChange,
}: {
  step: EditorStep;
  control: Control<AutomationTaskDto>;
  triggerDone: boolean;
  whereDone: boolean;
  onStepChange: (step: EditorStep) => void;
}) {
  const done: Record<EditorStep, boolean> = {
    task: useTaskGap(control) === null,
    trigger: triggerDone,
    where: whereDone,
  };
  return <EditorStepTabs step={step} done={done} onStepChange={onStepChange} />;
}
