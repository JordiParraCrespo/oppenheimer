import { SearchInput } from '@oppenheimer/design-system-web';
import { useDebouncedCallback } from '@oppenheimer/frontend-web';
import { useState } from 'react';

/** How long typing has to settle before the picker is filtered again. */
const PERMISSION_SEARCH_DEBOUNCE_MS = 200;

/**
 * The permission picker's search field, and the only thing a keystroke
 * re-renders.
 *
 * The half-typed word is this component's state and leaves once typing
 * settles. While the live value sat in the form, every character re-filtered
 * the catalog and redrew every visible row and all three of its toggles — for
 * a query the reader had not finished writing.
 */
export function PermissionSearch({
  onChange,
  placeholder,
  disabled,
}: {
  /** Receives the settled query, once per burst of typing. */
  onChange: (query: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [live, setLive] = useState('');
  const commit = useDebouncedCallback(onChange, PERMISSION_SEARCH_DEBOUNCE_MS);

  return (
    <SearchInput
      value={live}
      onChange={(event) => {
        setLive(event.target.value);
        commit(event.target.value);
      }}
      placeholder={placeholder}
      aria-label={placeholder}
      hint={null}
      containerClassName="w-full"
      disabled={disabled}
    />
  );
}
