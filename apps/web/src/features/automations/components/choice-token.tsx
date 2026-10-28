import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  InlineToken,
} from '@oppenheimer/design-system-web';
import { useState } from 'react';

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * A token that reads its value and opens the choices under it: a facet of
 * the runs list ("All automations", "Last 7 days") at `sm`, or a part of a
 * trigger's sentence ("Weekdays", "Pull request opened") at `md`. `dirty`
 * turns it blue while it differs from the default, the frames' cue that a
 * filter is on. A facet caps its width and truncates, so a long name or a
 * longer locale cannot push the filter row onto another line.
 */
export function ChoiceToken({
  label,
  value,
  options,
  dirty,
  mono,
  size = 'sm',
  onValueChange,
}: {
  label: string;
  value: string;
  options: ChoiceOption[];
  dirty?: boolean;
  mono?: boolean;
  size?: 'sm' | 'md';
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <InlineToken
            size={size}
            mono={mono}
            dirty={dirty}
            open={open}
            title={size === 'sm' ? label : undefined}
            className={size === 'sm' ? 'max-w-52' : undefined}
          />
        }
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={size === 'sm' ? 'end' : 'start'} className="max-h-80 min-w-55">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            onValueChange(String(next));
            setOpen(false);
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              description={option.description}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
