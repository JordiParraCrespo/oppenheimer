import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuValue,
  SearchList,
} from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import type { FilterOption } from '../lib/session-filters';

/**
 * A facet of the sessions filter over a list the workspace grows (Project,
 * Repository, Host): the submenu row with the current pick, opening the
 * Bots picker's search list (`SearchList`) instead of radio rows. A pick
 * applies at once and the menu stays open, as the radio facets do. An
 * `action` is a row under the list that makes a new one (New project…); it
 * closes the menu, since what it opens is a dialog.
 */
export function FacetSearchSub({
  label,
  current,
  options,
  value,
  searchPlaceholder,
  onValueChange,
  action,
}: {
  label: string;
  /** The picked option's label, beside the facet's name. */
  current: string;
  options: FilterOption[];
  value: string;
  searchPlaceholder: string;
  onValueChange: (value: string) => void;
  action?: { label: string; onSelect: () => void };
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
          onPick={(option) => onValueChange(option.value)}
          searchPlaceholder={searchPlaceholder}
          emptyText={(query) => t('common.search.noMatch', { query })}
        />
        {action ? (
          <>
            <DropdownMenuSeparator className="mx-0" />
            <div className="p-1 pt-0">
              <DropdownMenuItem onClick={action.onSelect}>
                <Plus />
                {action.label}
              </DropdownMenuItem>
            </div>
          </>
        ) : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
