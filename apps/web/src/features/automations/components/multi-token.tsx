import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  InlineToken,
} from '@oppenheimer/design-system-web';
import { useState } from 'react';

/**
 * A token that picks one or more: the weekly schedule's days, a GitHub
 * card's repositories. The last one picked cannot be unpicked — a set that
 * must not be empty says so on its row instead.
 */
export function MultiToken({
  label,
  heading,
  options,
  value,
  mono,
  lastLabel,
  onValueChange,
}: {
  label: string;
  heading?: string;
  options: { value: string; label: string }[];
  value: readonly string[];
  mono?: boolean;
  /** The note on the one row that cannot be unpicked. */
  lastLabel?: string;
  onValueChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<InlineToken mono={mono} open={open} />}>
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-55">
        <DropdownMenuGroup>
          {heading ? <DropdownMenuLabel>{heading}</DropdownMenuLabel> : null}
          {options.map((option) => {
            const on = value.includes(option.value);
            const locked = on && value.length === 1;
            return (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={on}
                closeOnClick={false}
                disabled={locked}
                onCheckedChange={(checked) =>
                  onValueChange(
                    checked
                      ? options
                          .map((o) => o.value)
                          .filter((v) => v === option.value || value.includes(v))
                      : value.filter((v) => v !== option.value),
                  )
                }
              >
                <span className="flex flex-col">
                  <span>{option.label}</span>
                  {locked && lastLabel ? (
                    <span className="text-[11.5px] text-fg-subtle">{lastLabel}</span>
                  ) : null}
                </span>
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
