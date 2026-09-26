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
  /**
   * Where the row leads when it leaves the console: it renders as a link that
   * opens in a new tab. The repository picker's "Manage repository access"
   * goes to the GitHub App's own page this way, because the list of
   * repositories is decided there and nowhere in the console.
   */
  href?: string;
  onSelect?: () => void;
};

/**
 * The two shapes these parts are drawn in.
 *
 * `chip` is the scope pickers on New session: a 248px listbox under a 34px
 * chip, 13px rows at 1.35, an underlined search row, the current row in blue.
 * `menu` is the composer's engine button: a 252px pane of 13px rows at 1.47
 * with a tighter back row, a full-bleed search hairlined on both edges, and
 * the check as the only blue thing — because the export draws that one as a
 * menu rather than as a chip's listbox.
 *
 * It is one prop rather than a class list per call site: a menu is not a chip
 * with six overrides, and the last time it was, every new measurement landed
 * as another `className` in `AgentModelSelect`.
 */
type ChipSelectDensity = 'chip' | 'menu';

/**
 * One row of a list, for sizing a pane in rows rather than in pixels.
 *
 * A hair under the row it measures (a `menu` row is 31.1px tall), which is the
 * artboard's own arithmetic: the last visible row is cut rather than flush, so
 * a list that continues says so without a scrollbar.
 */
const LIST_ROW: Record<ChipSelectDensity, number> = { chip: 29.6, menu: 30.5 };

function matches(option: ChipSelectOption, term: string) {
  if (!term) return true;
  const hay = `${option.label} ${option.description ?? ''} ${option.keywords ?? ''}`.toLowerCase();
  return hay.includes(term);
}

/* ── Parts ───────────────────────────────────────────────────────────────── */

const TRIGGER_CLASSES =
  'group/chip-select inline-flex h-(--control-h-md) shrink-0 items-center gap-[7px] rounded-md border border-border-subtle bg-control px-3 text-[13.5px] whitespace-nowrap text-fg outline-none transition-[background-color,border-color,box-shadow] duration-fast ease-standard hover:border-border hover:bg-control-hover data-popup-open:border-primary data-popup-open:ring-3 data-popup-open:ring-ring focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0';

/**
 * The chip in the composer's scope band: 30px, borderless, muted, no chevron,
 * the hover wash on hover and while open. Four of them read as one sentence
 * on the grey band, which is why none of them is drawn as a control.
 */
const TAB_TRIGGER_CLASSES =
  'group/chip-select inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-[13px] whitespace-nowrap text-fg-muted outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface hover:text-fg data-popup-open:bg-hover-surface data-popup-open:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0';

type ChipSelectTriggerVariant = 'chip' | 'tab';

/** The chip. Pass `open` so the ring follows the popup. */
function ChipSelectTrigger({
  icon,
  open,
  placeholder,
  variant = 'chip',
  children,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  icon?: React.ReactNode;
  open?: boolean;
  placeholder?: React.ReactNode;
  /** `tab` is the borderless form inside the composer's scope band. */
  variant?: ChipSelectTriggerVariant;
}) {
  const empty = children === null || children === undefined || children === '';
  const tab = variant === 'tab';
  return (
    <button
      type="button"
      data-slot="chip-select-trigger"
      data-variant={variant}
      data-popup-open={open ? '' : undefined}
      aria-haspopup="listbox"
      aria-expanded={open}
      className={cn(tab ? TAB_TRIGGER_CLASSES : TRIGGER_CLASSES, className)}
      {...props}
    >
      {icon ? (
        <span
          className={cn(
            'flex [&_svg:not([class*=size-])]:size-3.5',
            tab ? 'text-inherit' : 'text-fg-subtle',
          )}
        >
          {icon}
        </span>
      ) : null}
      <span
        data-slot="chip-select-value"
        className={cn('truncate', empty && 'text-field-placeholder')}
      >
        {empty ? placeholder : children}
      </span>
      {tab ? null : (
        <ChevronDownIcon
          className={cn(
            'size-3 text-fg-subtle transition-transform duration-fast',
            open && 'rotate-180',
          )}
        />
      )}
    </button>
  );
}

/**
 * The listbox surface: 14px radius, 4px padding, the popover shadow.
 *
 * The density carries the pane's size, so a caller states one only to override
 * it (`RepositorySelect`, whose rows hold a branch cell). A `menu` pane takes
 * no height cap of its own: its list is capped in rows instead, so the search
 * row above it stays put while the models scroll.
 */
function ChipSelectPopup({
  density = 'chip',
  className,
  width,
  maxHeight,
  style,
  ...props
}: React.ComponentProps<typeof PopoverContent> & {
  density?: ChipSelectDensity;
  width?: number;
  maxHeight?: number;
}) {
  const height = maxHeight ?? (density === 'chip' ? 248 : undefined);
  return (
    <PopoverContent
      align="start"
      sideOffset={6}
      data-slot="chip-select-content"
      data-density={density}
      className={cn(
        'flex w-auto flex-col gap-0 overflow-x-hidden overflow-y-auto rounded-md border-0 bg-popover p-1 text-fg shadow-popover [scrollbar-width:thin]',
        className,
      )}
      style={{ width: width ?? (density === 'chip' ? 248 : 252), maxHeight: height, ...style }}
      {...props}
    />
  );
}

const SEARCH_CLASSES: Record<ChipSelectDensity, string> = {
  chip: 'mb-1 border-b px-[9px] py-1.5',
  // Full-bleed and hairlined above as well as below: in the engine pane it
  // divides the agent it belongs to from that agent's models, rather than
  // sitting under a heading the way a chip's search does.
  menu: '-mx-1 my-1 border-y px-[13px] py-[5px]',
};

/** The sticky search row: glyph, borderless input, hairline under it. */
function ChipSelectSearch({
  density = 'chip',
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'> & { density?: ChipSelectDensity }) {
  return (
    <div
      data-slot="chip-select-search"
      className={cn(
        'sticky top-0 z-1 flex items-center gap-[7px] border-border-subtle bg-popover',
        SEARCH_CLASSES[density],
      )}
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

const BACK_CLASSES: Record<ChipSelectDensity, string> = {
  chip: 'mb-1 gap-[7px] border-b border-border-subtle px-[9px] py-1.5 text-[12.5px]',
  // A row of the menu it heads, not a header over it: the search row below
  // carries the divider.
  menu: 'gap-2 rounded-sm px-2.5 py-[3px] text-[13px] leading-[1.47] hover:bg-hover-surface',
};

/** The back row of a nested pane ("‹ Branch for xrp-mobile"). */
function ChipSelectBack({
  density = 'chip',
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { density?: ChipSelectDensity }) {
  return (
    <button
      type="button"
      data-slot="chip-select-back"
      className={cn(
        'flex w-full items-center bg-popover text-left text-fg outline-none focus-visible:bg-hover-surface',
        BACK_CLASSES[density],
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
  'flex w-full cursor-default items-center rounded-sm px-2.5 py-1.5 text-left text-[13px] text-fg outline-hidden select-none transition-colors duration-instant hover:bg-hover-surface focus-visible:bg-hover-surface data-highlighted:bg-hover-surface data-disabled:pointer-events-none data-disabled:opacity-40';

const ITEM_DENSITY: Record<ChipSelectDensity, string> = {
  chip: 'gap-2.5 leading-[1.35]',
  menu: 'gap-[9px] leading-[1.47]',
};

/**
 * One option row: leading mark, label and description, the check when selected.
 *
 * The densities disagree about what "current" looks like, and that is the
 * point of them: a chip's current row goes blue, because the chip row above it
 * is a statement of scope and the listbox is how you change it; a menu's row
 * keeps its ink and lets the check be the only blue thing. `trailing` replaces
 * the check slot outright for a row that ends in something else — the engine
 * pane's agents, which end in a chevron into their models.
 */
function ChipSelectItem({
  density = 'chip',
  selected,
  leading,
  description,
  mono,
  highlighted,
  trailing,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  density?: ChipSelectDensity;
  selected?: boolean;
  leading?: React.ReactNode;
  description?: React.ReactNode;
  mono?: boolean;
  highlighted?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      data-slot="chip-select-option"
      data-selected={selected || undefined}
      data-highlighted={highlighted || undefined}
      className={cn(
        ITEM_CLASSES,
        ITEM_DENSITY[density],
        selected && density === 'chip' && 'text-link',
        className,
      )}
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
      {trailing ?? (
        <span
          className={cn(
            'flex w-3.5 shrink-0 items-center justify-center',
            density === 'menu' && 'text-link',
          )}
        >
          {selected ? <CheckIcon className="size-3.5" strokeWidth={2.5} /> : null}
        </span>
      )}
    </button>
  );
}

/**
 * The one line a pane shows instead of rows: "No host matches.", or — with
 * `live` — "Loading hosts…" while the list is still being read.
 *
 * `live` is one part rather than two because the difference is what the line
 * says and whether a screen reader is told it changed, not how it is drawn.
 * It exists at all because the alternative reads as broken: a chip disabled
 * until its query settles is indistinguishable from one the workspace may not
 * use, and "No repository matches." while the repositories are in flight is
 * simply false.
 */
function ChipSelectEmpty({
  live,
  className,
  ...props
}: React.ComponentProps<'div'> & { live?: boolean }) {
  return (
    <div
      data-slot="chip-select-empty"
      aria-live={live ? 'polite' : undefined}
      className={cn('px-3 py-3.5 text-center text-[12.5px] text-fg-muted', className)}
      {...props}
    />
  );
}

/**
 * The body of a pane: its rows, or the one line saying why there are none.
 *
 * Every picker here had the same three-branch ternary — loading, rows, empty —
 * and a fourth was one copy away, so it lives once. `rows` caps the box in
 * rows of the density rather than at a round number of pixels, and it is sized
 * from `total` (the pane's whole list) rather than from what a search has left
 * standing, or the box would resize under the cursor with every keystroke.
 */
function ChipSelectList({
  density = 'chip',
  rows,
  total = 0,
  loading = false,
  loadingText = 'Loading…',
  emptyText,
  empty,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  density?: ChipSelectDensity;
  /** Rows visible before it scrolls. Unset: the popup's own height governs. */
  rows?: number;
  total?: number;
  loading?: boolean;
  loadingText?: React.ReactNode;
  emptyText?: React.ReactNode;
  /** Nothing to show: the filtered list came back empty. */
  empty?: boolean;
}) {
  const capped =
    rows === undefined
      ? undefined
      : Math.min(rows, Math.max(1, total)) * LIST_ROW[density] + 2;

  return (
    <div
      data-slot="chip-select-list"
      className={cn(rows !== undefined && 'overflow-y-auto [scrollbar-width:none]', className)}
      style={capped === undefined ? style : { maxHeight: capped, ...style }}
      {...props}
    >
      {loading ? (
        <ChipSelectEmpty live>{loadingText}</ChipSelectEmpty>
      ) : empty ? (
        <ChipSelectEmpty>{emptyText}</ChipSelectEmpty>
      ) : (
        children
      )}
    </div>
  );
}

/** The pinned band at the foot for "Add host…": a plus, the label, a chevron. */
function ChipSelectActionRow({
  icon,
  href,
  className,
  children,
  onClick,
  ...props
}: Omit<React.ComponentProps<'button'>, 'onClick'> & {
  icon?: React.ReactNode;
  /** A destination outside the console; the row becomes a link in a new tab. */
  href?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
}) {
  const content = (
    <>
      <span className="flex shrink-0 text-fg-subtle [&_svg:not([class*=size-])]:size-[15px]">
        {icon ?? <PlusGlyph />}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRightIcon className="size-3.5 shrink-0 text-fg-subtle" />
    </>
  );
  return (
    <div
      data-slot="chip-select-footer"
      className="-mx-1 -mb-1 mt-1 border-t border-border-subtle p-1"
    >
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-slot="chip-select-action"
          className={cn(ITEM_CLASSES, 'gap-2.5 cursor-pointer no-underline', className)}
          onClick={onClick}
        >
          {content}
        </a>
      ) : (
        <button
          type="button"
          data-slot="chip-select-action"
          className={cn(ITEM_CLASSES, 'gap-2.5', className)}
          onClick={onClick}
          {...props}
        >
          {content}
        </button>
      )}
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
  loading = false,
  loadingText = 'Loading…',
  action,
  width,
  maxHeight,
  variant,
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
  /** The options are still being fetched: the chip stays live and says so. */
  loading?: boolean;
  loadingText?: string;
  action?: ChipSelectAction;
  width?: number;
  maxHeight?: number;
  /** `tab` inside the composer's scope band. */
  variant?: ChipSelectTriggerVariant;
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
            variant={variant}
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
        <ChipSelectList
          role="listbox"
          aria-label={ariaLabel}
          loading={loading}
          loadingText={loadingText}
          emptyText={emptyText}
          empty={visible.length === 0}
        >
          {visible.map((option, index) => (
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
          ))}
        </ChipSelectList>
        {action ? (
          <ChipSelectActionRow
            icon={action.icon}
            href={action.href}
            onClick={() => {
              setOpen(false);
              action.onSelect?.();
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
  ChipSelectList,
  ChipSelectPopup,
  ChipSelectSearch,
  ChipSelectTrigger,
};
export type { ChipSelectAction, ChipSelectDensity, ChipSelectOption, ChipSelectTriggerVariant };
