import {
  ChipSelectPopup,
  InlineToken,
  Input,
  Popover,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import type { TriggerFilter } from '@oppenheimer/shared/automations';
import { useState } from 'react';

/**
 * The narrowing part of a GitHub card: "targeting [main]", "labeled [bug]".
 * "Any" is one click; an exact value is typed, and applies on Enter or when
 * the field loses focus. The half-typed value is this token's, never the
 * card's.
 */
export function FilterToken({
  filter,
  anyLabel,
  placeholder,
  mono,
  onFilterChange,
}: {
  filter: TriggerFilter;
  anyLabel: string;
  placeholder: string;
  mono?: boolean;
  onFilterChange: (filter: TriggerFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(filter.op === 'equals' ? filter.value : '');
  const apply = () => {
    const value = text.trim();
    onFilterChange(value ? { op: 'equals', value } : { op: 'any' });
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) apply();
        setOpen(next);
      }}
    >
      <PopoverTrigger render={<InlineToken mono={mono && filter.op === 'equals'} open={open} />}>
        {filter.op === 'equals' ? filter.value : anyLabel}
      </PopoverTrigger>
      <ChipSelectPopup width={240} className="gap-2 p-2">
        <button
          type="button"
          onClick={() => {
            setText('');
            onFilterChange({ op: 'any' });
            setOpen(false);
          }}
          className="rounded-sm px-2.5 py-1.5 text-left text-[13px] text-fg transition-colors duration-fast hover:bg-hover-surface"
        >
          {anyLabel}
        </button>
        <Input
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              apply();
              setOpen(false);
            }
          }}
          autoFocus
        />
      </ChipSelectPopup>
    </Popover>
  );
}
