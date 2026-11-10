import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuValue,
  SearchList,
} from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FilterOption } from '../lib/session-filters';

/**
 * A facet of the sessions filter over a list the workspace grows (Project,
 * Repository, Host): the submenu row with the current pick, opening the
 * Bots picker's search list (`SearchList`) instead of radio rows. A pick
 * applies at once and the menu stays open, as the radio facets do. `value`
 * is the one row picked, or the set checked for a facet that takes several
 * (Repository); `onPick` says whether the row was checked or unchecked.
 * `children` draw under the list, the caller's own foot.
 */
export function FacetSearchSub({
  label,
  current,
  options,
  value,
  searchPlaceholder,
  onPick,
  children,
}: {
  label: string;
  /** The picked option's label, beside the facet's name. */
  current: string;
  options: FilterOption[];
  value: string | readonly string[];
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
          value={value}
          onPick={(option, selected) => onPick(option.value, selected)}
          searchPlaceholder={searchPlaceholder}
          emptyText={(query) => t('common.search.noMatch', { query })}
        />
        {children}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
