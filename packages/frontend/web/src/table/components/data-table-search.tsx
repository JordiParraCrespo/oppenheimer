import { SearchInput } from '@oppenheimer/design-system-web';
import { useSearchDraft } from '../../forms';
import {
  type DataTableSearch as DataTableSearchProps,
  TABLE_HEADER_CONTROL_SIZE,
} from '../lib/data-table-types';

/**
 * The table's search field, and the only thing a keystroke re-renders.
 *
 * What the reader is typing stays here until typing settles. While the live
 * value was a prop of `DataTable`, every character re-rendered the header, all
 * eight rows, every cell, every row menu and the pager — for a query that was
 * debounced anyway and had not been asked yet.
 *
 * The draft, the debounce and the echo rule are `useSearchDraft` in the kit's
 * `forms` concern, because they are the policy rather than this field: the
 * settled value comes back down as `value` (the URL is where it lives) and the
 * hook is what keeps the field from taking its own commit for news. This file
 * is the markup and the table's own sizing.
 */
export function DataTableSearch({ value, onChange, placeholder }: DataTableSearchProps) {
  const { draft, type } = useSearchDraft({ value, onChange });

  return (
    <SearchInput
      containerClassName="w-70"
      size={TABLE_HEADER_CONTROL_SIZE}
      hint={null}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => type(event.target.value)}
    />
  );
}
