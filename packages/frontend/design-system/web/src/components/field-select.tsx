'use client';

import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Checkbox } from './checkbox';
import { ChipSelectEmpty, ChipSelectItem, ChipSelectPopup, ChipSelectSearch } from './chip-select';
import { Popover, PopoverTrigger } from './popover';

/**
 * FieldSelect — the routine editor's picker: a 42px labelled field on a
 * 10px radius whose value and a muted mono `meta` ("1 repo", "+1",
 * "idle") sit on one line. It opens the same listbox the scope chips use,
 * with a search row and, when `multiple`, a checkbox per row and a check
 * on the picked ones. Options can carry a `group` eyebrow ("In XRP
 * Mobile").
 *
 * Wrap it in `Field` + `FieldLabel` like any control.
 */
type FieldSelectOption = {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  group?: string;
  disabled?: boolean;
};

type FieldSelectProps = {
  options: FieldSelectOption[];
  meta?: React.ReactNode;
  placeholder?: React.ReactNode;
  searchPlaceholder?: string;
  emptyText?: (query: string) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  /** Popup width; defaults to the trigger's. */
  width?: number;
} & (
  | { multiple?: false; value: string | null; onValueChange: (value: string) => void }
  | { multiple: true; value: string[]; onValueChange: (value: string[]) => void }
);

function FieldSelect(props: FieldSelectProps) {
  const {
    options,
    meta,
    placeholder = 'Choose…',
    searchPlaceholder = 'Search…',
    emptyText = (query) => `No match for “${query}”.`,
    disabled,
    className,
    'aria-label': ariaLabel,
    width,
  } = props;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const trigger = React.useRef<HTMLButtonElement>(null);
  const term = query.trim().toLowerCase();
  const picked = new Set(props.multiple ? props.value : props.value ? [props.value] : []);
  const shown = options.filter((option) =>
    term ? `${String(option.label)} ${String(option.description ?? '')}`.toLowerCase().includes(term) : true,
  );
  const label = props.multiple
    ? options.find((option) => option.value === props.value[0])?.label
    : options.find((option) => option.value === props.value)?.label;
  const extra = props.multiple && props.value.length > 1 ? `+${props.value.length - 1}` : null;

  function pick(value: string) {
    if (props.multiple) {
      const next = picked.has(value) ? props.value.filter((v) => v !== value) : [...props.value, value];
      props.onValueChange(next);
    } else {
      props.onValueChange(value);
      setOpen(false);
    }
  }

  let lastGroup: string | undefined;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger
        render={
          <button
            ref={trigger}
            type="button"
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            disabled={disabled}
            data-slot="field-select"
            className={cn(
              'flex h-(--control-h-lg) w-full items-center gap-2 rounded-sm border border-border bg-card pr-3 pl-3.5 text-left text-sm text-fg outline-none transition-[border-color,box-shadow] duration-fast ease-standard hover:border-fg-subtle focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring data-popup-open:border-primary data-popup-open:ring-3 data-popup-open:ring-ring disabled:pointer-events-none disabled:opacity-50',
              className,
            )}
          />
        }
      >
        <span
          key={String(label ?? '')}
          className={cn('min-w-0 flex-1 truncate motion-safe:animate-label-in', label === undefined && 'text-fg-subtle')}
        >
          {label ?? placeholder}
        </span>
        {extra ? <span className="figures shrink-0 text-[11.5px] text-fg-subtle">{extra}</span> : null}
        {meta ? <span className="figures shrink-0 text-[11.5px] text-fg-subtle">{meta}</span> : null}
        <ChevronDownIcon className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
      </PopoverTrigger>
      <ChipSelectPopup
        width={width ?? trigger.current?.offsetWidth ?? 260}
        maxHeight={320}
        side="bottom"
        align="start"
      >
        <ChipSelectSearch
          value={query}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div role="listbox" aria-multiselectable={props.multiple || undefined} className="max-h-[220px] overflow-y-auto">
          {shown.length === 0 ? (
            <ChipSelectEmpty className="text-left text-fg-muted">{emptyText(query)}</ChipSelectEmpty>
          ) : (
            shown.map((option) => {
              const eyebrow = option.group && option.group !== lastGroup ? option.group : null;
              lastGroup = option.group;
              const on = picked.has(option.value);
              return (
                <React.Fragment key={option.value}>
                  {eyebrow ? <div className="eyebrow px-2.5 pt-2 pb-1">{eyebrow}</div> : null}
                  <ChipSelectItem
                    selected={on}
                    description={option.description}
                    disabled={option.disabled}
                    leading={
                      props.multiple ? (
                        <Checkbox checked={on} tabIndex={-1} aria-hidden className="pointer-events-none size-4" />
                      ) : undefined
                    }
                    onClick={() => pick(option.value)}
                    className={props.multiple ? '[&>span:last-child]:hidden' : undefined}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {props.multiple && on ? (
                        <CheckIcon className="size-3.5 shrink-0 text-link" strokeWidth={2.5} aria-hidden />
                      ) : null}
                    </span>
                  </ChipSelectItem>
                </React.Fragment>
              );
            })
          )}
        </div>
      </ChipSelectPopup>
    </Popover>
  );
}

export { FieldSelect };
export type { FieldSelectOption };
