import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@oppenheimer/design-system-web';
import { ChevronDownIcon } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';

export interface ShareMenuOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Write access: a shell on the host as the person sharing. */
  warning?: boolean;
}

/**
 * One of Share's settings as a quiet button that reads its value and opens
 * a menu of the choices, each with a line saying what it means. A choice
 * closes the menu: it is a decision, not a setting to flip and compare.
 */
export function ShareMenuSelect<T extends string>({
  label,
  value,
  current,
  options,
  onChange,
  disabled,
}: {
  /** What the setting is, for a screen reader ("Permission"). */
  label: string;
  value: T;
  /** What the button reads: the choice's label, or a live "23h 59m". */
  current: ReactNode;
  options: readonly ShareMenuOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={label}
            className="-mr-1.5 shrink-0 gap-1 text-fg-muted"
          />
        }
      >
        {current}
        <ChevronDownIcon className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[288px]">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              icon={option.icon}
              description={option.description}
              disabled={option.disabled}
              tone={option.warning ? 'warning' : 'default'}
              density="compact"
              closeOnClick
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
