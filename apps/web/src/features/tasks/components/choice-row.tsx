import { Chip } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';

export interface Choice {
  value: string | null;
  label: string;
  /** A dot or glyph before the label (a column's). */
  icon?: ReactNode;
}

/**
 * One labelled row of the task dialog (`Tasks.dc.html`): a label in the left
 * column and the choices as pills, the picked one in the selected tint. The
 * pills stand at the field height, level with the inputs above and below
 * them, and the label takes the same height so it centres on the first line.
 */
export function ChoiceRow({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: readonly Choice[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-3">
      <span className="flex h-(--control-h-md) items-center text-sm text-fg-muted">{label}</span>
      <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0" aria-label={label}>
        {choices.map((choice) => (
          <Chip
            key={choice.value ?? 'none'}
            variant="solid"
            size="md"
            selected={choice.value === value}
            icon={choice.icon}
            onClick={() => onChange(choice.value)}
          >
            {choice.label}
          </Chip>
        ))}
      </fieldset>
    </div>
  );
}
