import { Check } from '@oppenheimer/design-system-web/icons';
import { cn } from '@oppenheimer/design-system-web/utils';
import type { AutomationTaskDto } from '@oppenheimer/shared/schemas/automation';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useTaskGap } from '../hooks/use-task-done';

export const EDITOR_STEPS = ['task', 'trigger', 'where'] as const;
export type EditorStep = (typeof EDITOR_STEPS)[number];

/**
 * The editor's three steps as tabs: Task, Trigger, Where it runs. A step is
 * reachable once every step before it is complete; a complete step other
 * than the open one shows a tick where its number was, except the last,
 * which is prefilled and done when saved.
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
  const { t } = useTranslation();
  const done: Record<EditorStep, boolean> = {
    task: useTaskGap(control) === null,
    trigger: triggerDone,
    where: whereDone,
  };
  return (
    <div
      role="tablist"
      aria-label={t('automations.editor.steps.label')}
      className="mx-6 flex gap-1 rounded-pill bg-hover-surface p-1"
    >
      {EDITOR_STEPS.map((candidate, index) => {
        const on = candidate === step;
        const reachable = EDITOR_STEPS.slice(0, index).every((before) => done[before]);
        // The last step is prefilled, so it never reads as done: saving is its tick.
        const ticked = done[candidate] && !on && index < EDITOR_STEPS.length - 1;
        return (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={!reachable}
            onClick={() => onStepChange(candidate)}
            className={cn(
              'flex h-8 flex-1 items-center justify-center gap-2 rounded-pill text-[13px] transition-colors duration-fast disabled:opacity-50',
              on ? 'bg-popover text-fg shadow-popover' : 'text-fg-muted hover:text-fg',
            )}
          >
            <span
              className={cn(
                'figures flex size-4.5 items-center justify-center rounded-pill text-[10.5px]',
                ticked
                  ? 'bg-success text-popover'
                  : on
                    ? 'bg-fg text-popover'
                    : 'bg-border-subtle text-fg-muted',
              )}
            >
              {ticked ? <Check className="size-3" strokeWidth={3} /> : index + 1}
            </span>
            {t(`automations.editor.steps.${candidate}`)}
          </button>
        );
      })}
    </div>
  );
}
