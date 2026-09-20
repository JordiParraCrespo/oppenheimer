'use client';

import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/**
 * ChipSelect — a scope decision stated as a chip: "Run X on host **mac-studio**,
 * repo **xrp-mobile**, branch **main**, with **Claude Code**". Four of them in a
 * row on New session, so the row reads as a sentence instead of a form.
 *
 * Every one of them filters. The trigger is a 34px chip at the 14px radius on
 * the control fill with a leading icon, the current value and a chevron; open,
 * it takes the blue ring. The popup is a 248px listbox: a sticky search row on
 * top, options with a label, an optional leading mark, a muted second line
 * where the value alone is not enough, and a check on the selected one; a
 * centred "No host matches." line when the query finds nothing; and, when the
 * list can grow, a pinned action band at the foot ("Add host…") with a plus and
 * a chevron, because it opens something rather than choosing.
 *
 * Built on Popover rather than Base UI Select, which has no filtering. The
 * parts (`ChipSelectTrigger`, `ChipSelectPopup`, `ChipSelectSearch`,
 * `ChipSelectItem`, …) are exported so a picker with more than one pane, such
 * as `RepositorySelect`, is the same chip and the same rows.
 *
 * ```tsx
 * <ChipSelect
 *   value={host}
 *   onValueChange={setHost}
 *   options={hosts}
 *   icon={<CpuIcon />}
 *   aria-label="Host"
 *   searchPlaceholder="Search hosts…"
 *   emptyText="No host matches."
 *   action={{ label: 'Add host…', onSelect: openAddHost }}
 * />
 * ```
 */
type ChipSelectOption = {
  value: string;
  label: string;
  /** A muted second line, searched as well as shown. */
  description?: string;
  /** A 15px mark before the label (an `AgentMark`, a glyph). */
  leading?: React.ReactNode;
  /** Extra words the search matches on, never shown. */
  keywords?: string;
  /** Mono label at 12px: branches, paths. */
  mono?: boolean;
  disabled?: boolean;
};

type ChipSelectAction = {
  label: string;
  /** Defaults to a plus. */
  icon?: React.ReactNode;
  onSelect: () => void;
};

function matches(option: ChipSelectOption, term: string) {
  if (!term) return true;
  const hay = `${option.label} ${option.description ?? ''} ${option.keywords ?? ''}`.toLowerCase();
  return hay.includes(term);
}

/* ── Parts ───────────────────────────────────────────────────────────────── */

const TRIGGER_CLASSES =
  'group/chip-select inline-flex h-(--control-h-md) shrink-0 items-center gap-[7px] rounded-md border border-border-subtle bg-control px-3 text-[13.5px] whitespace-nowrap text-fg outline-none transition-[background-color,border-color,box-shadow] duration-fast ease-standard hover:border-border hover:bg-control-hover data-popup-open:border-primary data-popup-open:ring-3 data-popup-open:ring-ring focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0';

/** The chip. Pass `open` so the ring follows the popup. */
function ChipSelectTrigger({
  icon,
  open,
  placeholder,
  children,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  icon?: React.ReactNode;
  open?: boolean;
  placeholder?: React.ReactNode;
}) {
  const empty = children === null || children === undefined || children === '';
  return (
    <button
      type="button"
      data-slot="chip-select-trigger"
      data-popup-open={open ? '' : undefined}
      aria-haspopup="listbox"
      aria-expanded={open}
      className={cn(TRIGGER_CLASSES, className)}
      {...props}
    >
      {icon ? (
        <span className="flex text-fg-subtle [&_svg:not([class*=size-])]:size-3.5">{icon}</span>
      ) : null}
      <span
        data-slot="chip-select-value"
        className={cn('truncate', empty && 'text-field-placeholder')}
      >
        {empty ? placeholder : children}
      </span>
      <ChevronDownIcon
        className={cn(
          'size-3 text-fg-subtle transition-transform duration-fast',
          open && 'rotate-180',
        )}
      />
    </button>
  );
}

/** The listbox surface: 14px radius, 4px padding, the popover shadow. */
function ChipSelectPopup({
  className,
  width = 248,
  maxHeight = 248,
  style,
  ...props
}: React.ComponentProps<typeof PopoverContent> & { width?: number; maxHeight?: number }) {
  return (
    <PopoverContent
      align="start"
      sideOffset={6}
      data-slot="chip-select-content"
      className={cn(
        'flex w-auto flex-col gap-0 overflow-x-hidden overflow-y-auto rounded-md border-0 bg-popover p-1 text-fg shadow-popover [scrollbar-width:thin]',
        className,
      )}
      style={{ width, maxHeight, ...style }}
      {...props}
    />
  );
}

/** The sticky search row: glyph, borderless input, hairline under it. */
function ChipSelectSearch({
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <div
      data-slot="chip-select-search"
      className="sticky top-0 z-1 mb-[5px] flex items-center gap-[7px] border-b border-border-subtle bg-popover px-[9px] py-1.5"
    >
      <SearchIcon className="size-3.5 shrink-0 text-fg-subtle" />
      <input
        // biome-ignore lint/a11y/noAutofocus: the search is the reason the popup opened
        autoFocus
        type="text"
        className={cn(
          'min-w-0 flex-1 bg-transparent p-0 text-[12.5px] text-fg outline-none placeholder:text-field-placeholder',
          className,
        )}
        {...props}
      />
    </div>
  );
}

/** The back row of a nested pane ("‹ Branch for xrp-mobile"). */
function ChipSelectBack({ className, children, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-slot="chip-select-back"
      className={cn(
        'mb-[5px] flex w-full items-center gap-[7px] border-b border-border-subtle bg-popover px-[9px] py-1.5 text-left text-[12.5px] text-fg outline-none hover:text-fg focus-visible:bg-hover-surface',
        className,
      )}
      {...props}
    >
      <ChevronLeftIcon className="size-3.5 shrink-0 text-fg-subtle" />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

const ITEM_CLASSES =
  'flex w-full cursor-default items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-[13px] leading-[1.35] text-fg outline-hidden select-none transition-colors duration-instant hover:bg-hover-surface focus-visible:bg-hover-surface data-highlighted:bg-hover-surface data-disabled:pointer-events-none data-disabled:opacity-40';

/** One option row: leading mark, label and description, the check when selected. */
function ChipSelectItem({
  selected,
  leading,
  description,
  mono,
  highlighted,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  selected?: boolean;
  leading?: React.ReactNode;
  description?: React.ReactNode;
  mono?: boolean;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      data-slot="chip-select-option"
      data-selected={selected || undefined}
      data-highlighted={highlighted || undefined}
      className={cn(ITEM_CLASSES, selected && 'text-link', className)}
      {...props}
    >
      {leading ? (
        <span className="flex w-[15px] shrink-0 justify-center text-fg-subtle [&_svg:not([class*=size-])]:size-[15px]">
          {leading}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate', mono && 'figures text-xs leading-[1.45]')}>{children}</span>
        {description ? (
          <span className="truncate text-[11px] leading-[1.35] text-fg-subtle">{description}</span>
        ) : null}
      </span>
      <span className="flex w-3.5 shrink-0 items-center justify-center">
        {selected ? <CheckIcon className="size-3.5" strokeWidth={2.5} /> : null}
      </span>
    </button>
  );
}

/** "No host matches." */
function ChipSelectEmpty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="chip-select-empty"
      className={cn('px-3 py-3.5 text-center text-[12.5px] text-fg-muted', className)}
      {...props}
    />
  );
}

/** The pinned band at the foot for "Add host…": a plus, the label, a chevron. */
function ChipSelectActionRow({
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { icon?: React.ReactNode }) {
  return (
    <div
      data-slot="chip-select-footer"
      className="-mx-1 -mb-1 mt-[3px] border-t border-border-subtle px-1 py-[3px]"
    >
      <button
        type="button"
        data-slot="chip-select-action"
        className={cn(ITEM_CLASSES, className)}
        {...props}
      >
        <span className="flex shrink-0 text-fg-subtle [&_svg:not([class*=size-])]:size-[15px]">
          {icon ?? <PlusGlyph />}
        </span>
        <span className="min-w-0 flex-1 truncate">{children}</span>
        <ChevronRightIcon className="size-3.5 shrink-0 text-fg-subtle" />
      </button>
    </div>
  );
}

function PlusGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

/* ── The single-value picker ─────────────────────────────────────────────── */

function ChipSelect({
  options,
  value,
  onValueChange,
  icon,
  placeholder,
  searchPlaceholder = 'Search…',
  emptyText = 'No matches.',
  action,
  width,
  maxHeight,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  options: ChipSelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  icon?: React.ReactNode;
  placeholder?: React.ReactNode;
  searchPlaceholder?: string;
  emptyText?: string;
  action?: ChipSelectAction;
  width?: number;
  maxHeight?: number;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const term = query.trim().toLowerCase();
  const visible = options.filter((option) => matches(option, term));
  const selected = options.find((option) => option.value === value) ?? null;

  function choose(option: ChipSelectOption) {
    onValueChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = visible[active];
      if (option && !option.disabled) choose(option);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setActive(0);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger
        render={
          <ChipSelectTrigger
            icon={icon}
            open={open}
            placeholder={placeholder}
            aria-label={ariaLabel}
            disabled={disabled}
            className={className}
          >
            {selected ? selected.label : null}
          </ChipSelectTrigger>
        }
      />
      <ChipSelectPopup width={width} maxHeight={maxHeight}>
        <ChipSelectSearch
          value={query}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <div role="listbox" aria-label={ariaLabel}>
          {visible.length > 0 ? (
            visible.map((option, index) => (
              <ChipSelectItem
                key={option.value}
                selected={option.value === value}
                highlighted={index === active}
                leading={option.leading}
                description={option.description}
                mono={option.mono}
                data-disabled={option.disabled || undefined}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                {option.label}
              </ChipSelectItem>
            ))
          ) : (
            <ChipSelectEmpty>{emptyText}</ChipSelectEmpty>
          )}
        </div>
        {action ? (
          <ChipSelectActionRow
            icon={action.icon}
            onClick={() => {
              setOpen(false);
              action.onSelect();
            }}
          >
            {action.label}
          </ChipSelectActionRow>
        ) : null}
      </ChipSelectPopup>
    </Popover>
  );
}

export {
  ChipSelect,
  ChipSelectActionRow,
  ChipSelectBack,
  ChipSelectEmpty,
  ChipSelectItem,
  ChipSelectPopup,
  ChipSelectSearch,
  ChipSelectTrigger,
};
export type { ChipSelectAction, ChipSelectOption };
