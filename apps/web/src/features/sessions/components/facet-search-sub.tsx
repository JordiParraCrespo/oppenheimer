import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuValue,
  SearchList,
} from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL, type FilterOption } from '../lib/session-filters';

/**
 * A facet of the sessions filter over a list the workspace grows (Project,
 * Repository, Host): the submenu row with the current pick, opening the
 * Bots picker's search list (`SearchList`) instead of radio rows. A pick
 * applies at once and the menu stays open, as the radio facets do. `value`
 * is the facet's picked set (empty for all). A `multiple` facet draws it as
 * checks and `onPick` says whether the row was checked or unchecked; any
 * other draws one pick, and `onPick` always says checked.
 * `children` draw under the list, the caller's own foot.
 */
export function FacetSearchSub({
  label,
  current,
  options,
  value,
  multiple = false,
  searchPlaceholder,
  onPick,
  children,
}: {
  label: string;
  /** The picked option's label, beside the facet's name. */
  current: string;
  options: FilterOption[];
  value: readonly string[];
  multiple?: boolean;
  searchPlaceholder: string;
  onPick: (value: string, selected: boolean) => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {label}
        <DropdownMenuValue>{current}</DropdownMenuValue>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-68 p-0">
        <SearchList
          aria-label={label}
          options={options}
          value={multiple ? (value.length > 0 ? value : [ALL]) : (value[0] ?? ALL)}
          onPick={(option, selected) => onPick(option.value, selected)}
          searchPlaceholder={searchPlaceholder}
          emptyText={(query) => t('common.search.noMatch', { query })}
        />
        {children}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
