// uncatalogued: a submenu's search-and-list body; the filter-menu row covers the choice
'use client';

import { SearchIcon } from 'lucide-react';
import * as React from 'react';

import { ComboboxField } from '../internal/combobox-field';
import { cn } from '../lib/utils';
import {
  ChipSelectCombobox,
  ChipSelectItem,
  ChipSelectList,
  type ChipSelectOption,
} from './chip-select';

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
 * keys are `ChipSelectCombobox`'s: the arrows move the highlight, scrolling it
 * into view, Enter picks it, and a screen reader hears which one it will pick.
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
  const [query, setQuery] = React.useState('');
  const term = query.trim().toLowerCase();
  const visible = options.filter((option) => matches(option, term));
  const set = Array.isArray(value) ? (value as readonly V[]) : null;
  const isSelected = (option: SearchListOption<V>) =>
    set ? set.includes(option.value) : option.value === value;
  const pick = (option: SearchListOption<V>) => {
    if (!option.disabled) onPick(option, set ? !isSelected(option) : true);
  };

  return (
    <div data-slot="search-list" className={cn('flex min-w-0 flex-col', className)}>
      <ChipSelectCombobox query={query} onQueryChange={setQuery} autoHighlight="always">
        <div className="px-1 pt-1">
          <ComboboxField
            quiet
            leading={<SearchIcon className="size-3.5" />}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onKeyDown={(event) => {
              // A menu around the list would read the rest as its own navigation.
              if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation();
            }}
          />
        </div>
        <ChipSelectList
          density="menu"
          aria-label={ariaLabel}
          aria-multiselectable={set ? true : undefined}
          rows={rows}
          total={options.length}
          empty={visible.length === 0}
          emptyText={emptyText(query.trim())}
          className="p-1"
        >
          {visible.map((option) => (
            <ChipSelectItem
              key={option.value ?? ''}
              density="menu"
              selected={isSelected(option)}
              leading={option.leading}
              description={option.description}
              mono={option.mono}
              count={option.count}
              disabled={option.disabled}
              data-disabled={option.disabled || undefined}
              onClick={() => pick(option)}
            >
              {option.label}
            </ChipSelectItem>
          ))}
        </ChipSelectList>
      </ChipSelectCombobox>
    </div>
  );
}

export { SearchList };
export type { SearchListOption };
