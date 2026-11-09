import { Check } from '@oppenheimer/design-system-web/icons';
import { cn } from '@oppenheimer/design-system-web/utils';
import { useTranslation } from 'react-i18next';

export const EDITOR_STEPS = ['task', 'trigger', 'where'] as const;
export type EditorStep = (typeof EDITOR_STEPS)[number];

/**
 * The editor's three steps as tabs, drawn from what is done: Task, Trigger,
 * Where it runs. A step is reachable once every step before it is complete;
 * a complete step other than the open one shows a tick where its number
 * was, except the last, which is prefilled and done when saved. With
 * nothing done (the editor's placeholder) only the first is reachable.
 */
export function EditorStepTabs({
  step,
  done,
  onStepChange,
}: {
  step: EditorStep;
  done: Record<EditorStep, boolean>;
  onStepChange?: (step: EditorStep) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="tablist"
      aria-label={t('automations.editor.steps.label')}
      className="mx-7 mt-4.5 flex gap-0.5 rounded-pill bg-hover-surface p-0.75"
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
            disabled={!reachable || !onStepChange}
            onClick={() => onStepChange?.(candidate)}
            className={cn(
              'flex h-7.5 flex-1 items-center justify-center gap-1.75 rounded-pill px-3 text-sm transition-colors duration-fast disabled:cursor-default',
              on ? 'bg-popover text-fg' : 'text-fg-muted enabled:hover:text-fg',
            )}
          >
            <span
              className={cn(
                'figures flex size-4 items-center justify-center rounded-pill text-micro',
                ticked
                  ? 'bg-success text-popover'
                  : on
                    ? 'bg-fg text-popover'
                    : 'bg-border-subtle text-fg-muted',
              )}
            >
              {ticked ? <Check className="size-2.75" strokeWidth={3} /> : index + 1}
            </span>
            {t(`automations.editor.steps.${candidate}`)}
          </button>
        );
      })}
    </div>
  );
}
