import { SearchInput } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { useDebouncedCallback } from '../hooks/use-debounced-callback';
import {
  type DataTableSearch as DataTableSearchProps,
  TABLE_HEADER_CONTROL_SIZE,
  TABLE_SEARCH_DEBOUNCE_MS,
} from '../lib/data-table-types';

/**
 * The table's search field, and the only thing a keystroke re-renders.
 *
 * What the reader is typing is this component's state. It leaves only once
 * typing settles, which is what makes the difference measurable: while the live
 * value was a prop of `DataTable`, every character re-rendered the header, all
 * eight rows, every cell, every row menu and the pager — for a query that was
 * debounced anyway and had not been asked yet.
 *
 * The settled value still comes back down as `value`, because the URL is where
 * it lives: a followed link, a cleared filter or a back button changes it
 * without anyone typing, and the field has to follow. What it must *not* follow
 * is the echo of its own commit. Those two look identical from here — both
 * arrive as a changed `value` — so the field remembers what it last sent up and
 * ignores that one string coming back. Without it, any delay between `onChange`
 * and the prop returning (a parent holding search in its own state, a debounced
 * URL write) lands the old burst on a reader who has carried on typing, and the
 * caret string snaps backwards.
 */
export function DataTableSearch({ value, onChange, placeholder }: DataTableSearchProps) {
  const [live, setLive] = useState(value);

  // Adjusting state to a prop, the way React documents it rather than with an
  // effect. An emitted value is ignored exactly once when the parent echoes it
  // back; after that, the same string is allowed to arrive from navigation.
  // `externalRevision` invalidates a local timer only for genuine outside
  // changes, never for an echo while the reader has carried on typing.
  const [sync, setSync] = useState({
    settled: value,
    emitted: null as string | null,
    externalRevision: 0,
  });
  if (sync.settled !== value) {
    const isEcho = value === sync.emitted;
    setSync({
      settled: value,
      emitted: null,
      externalRevision: sync.externalRevision + (isEcho ? 0 : 1),
    });
    if (!isEcho) setLive(value);
  }

  const commit = useDebouncedCallback(
    (next: string) => {
      setSync((current) => ({ ...current, emitted: next }));
      onChange(next);
    },
    TABLE_SEARCH_DEBOUNCE_MS,
    sync.externalRevision,
  );

  return (
    <SearchInput
      containerClassName="w-70"
      size={TABLE_HEADER_CONTROL_SIZE}
      hint={null}
      placeholder={placeholder}
      value={live}
      onChange={(event) => {
        setLive(event.target.value);
        commit(event.target.value);
      }}
    />
  );
}
