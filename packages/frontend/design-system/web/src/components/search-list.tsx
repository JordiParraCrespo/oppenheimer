// uncatalogued: a submenu's search-and-list body; the filter-menu row covers the choice
'use client';

import { SearchIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { ChipSelectItem, ChipSelectList, type ChipSelectOption } from './chip-select';
import { Input } from './input';

/** A row of a `SearchList`: a `ChipSelectOption` whose value may be `null` (Ungrouped, No project). */
type SearchListOption<V extends string | null = string> = Omit<ChipSelectOption, 'value'> & {
  value: V;
};

function matches(option: SearchListOption<string | null>, term: string) {
  if (!term) return true;
  return `${option.label} ${option.description ?? ''} ${option.keywords ?? ''}`
    .toLowerCase()
    .includes(term);
}

/**
 * SearchList — a list the workspace grows, under a search field: the Bots
 * picker's shape (a quiet field with the glyph, then `menu` rows with the
 * check and the count), for any pick whose options are projects, milestones,
 * automations, hosts, repositories or groups. A fixed list (a sort, a window,
 * the lanes) stays a menu of radio rows.
 *
 * It is only the body, so it sits wherever the pick opens: a
 * `ChipSelectPopup` (`SearchableFacetSelect`), a `DropdownMenuSubContent`, or
 * a pane of a row's menu. Its rows are not menu items, so a menu around it
 * neither moves focus to the row under the pointer nor reads the typed text
 * as typeahead; the field keeps every key but Escape and Tab to itself. The
 * arrows move the highlight, scrolling it into view, and Enter picks it; the
 * field is a combobox whose active descendant is the highlighted row, so a
 * screen reader hears which one Enter will pick.
 *
 * `value` is the one value picked (`null` when nothing is: a Move to… pane),
 * or the set checked. `onPick` hands back the
 * row and the state it asks for: `true` to pick or check it, `false` to
 * uncheck it (a set only). The caller decides whether that closes anything.
 * The field empties when the list unmounts with its popup.
 *
 * ```tsx
 * <SearchList
 *   options={projects}
 *   value={project}
 *   onPick={(option) => setProject(option.value)}
 *   searchPlaceholder="Search projects"
 *   emptyText={(query) => `No project matches “${query}”.`}
 * />
 * ```
 */
function SearchList<V extends string | null>({
  options,
  value,
  onPick,
  searchPlaceholder,
  emptyText,
  rows = 8,
  className,
  'aria-label': ariaLabel,
}: {
  options: SearchListOption<V>[];
  /** The one value picked (`null` for none yet), or the set checked. */
  value: V | null | readonly V[];
  onPick: (option: SearchListOption<V>, selected: boolean) => void;
  searchPlaceholder: string;
  emptyText: (query: string) => React.ReactNode;
  /** Rows visible before the list scrolls. */
  rows?: number;
  className?: string;
  'aria-label'?: string;
}) {
  const id = React.useId();
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const term = query.trim().toLowerCase();
  const visible = options.filter((option) => matches(option, term));
  const set = Array.isArray(value) ? (value as readonly V[]) : null;
  const isSelected = (option: SearchListOption<V>) =>
    set ? set.includes(option.value) : option.value === value;
  const optionId = (index: number) => `${id}-option-${index}`;
  const pick = (option: SearchListOption<V> | undefined) => {
    if (option && !option.disabled) onPick(option, set ? !isSelected(option) : true);
  };
  // The field keeps focus, so the list follows the arrow keys on its own.
  const move = (step: number) => {
    const next = Math.min(Math.max(active + step, 0), visible.length - 1);
    setActive(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' });
  };

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Tab') return;
    // A menu around the list would read the rest as its own navigation.
    event.stopPropagation();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(visible[active]);
    }
  }

  return (
    <div data-slot="search-list" className={cn('flex min-w-0 flex-col', className)}>
      <div className="px-1 pt-1">
        <Input
          size="md"
          quiet
          // biome-ignore lint/a11y/noAutofocus: the search is the reason the list opened
          autoFocus
          leading={<SearchIcon className="size-3.5" />}
          value={query}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          role="combobox"
          aria-expanded
          aria-autocomplete="list"
          aria-controls={`${id}-list`}
          aria-activedescendant={visible[active] ? optionId(active) : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <ChipSelectList
        density="menu"
        id={`${id}-list`}
        role="listbox"
        aria-label={ariaLabel}
        aria-multiselectable={set ? true : undefined}
        rows={rows}
        total={options.length}
        empty={visible.length === 0}
        emptyText={emptyText(query.trim())}
        className="p-1"
      >
        {visible.map((option, index) => (
          <ChipSelectItem
            key={option.value ?? ''}
            id={optionId(index)}
            tabIndex={-1}
            density="menu"
            selected={isSelected(option)}
            highlighted={index === active}
            leading={option.leading}
            description={option.description}
            mono={option.mono}
            count={option.count}
            data-disabled={option.disabled || undefined}
            aria-disabled={option.disabled || undefined}
            onMouseEnter={() => setActive(index)}
            onClick={() => pick(option)}
          >
            {option.label}
          </ChipSelectItem>
        ))}
      </ChipSelectList>
    </div>
  );
}

export { SearchList };
export type { SearchListOption };
