import { useDebouncedCallback } from '@oppenheimer/design-system-web';
import { Search } from '@oppenheimer/design-system-web/icons';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { type Ref, useState } from 'react';

/**
 * The queue's search box. It owns the half-typed word and hands the table the
 * settled one, once per burst of typing, so a keystroke renders this field and
 * not the rows. Escape clears it and lets go of the focus.
 */
export function QueueSearchField({
  onChange,
  label,
  inputRef,
}: {
  onChange: (query: string) => void;
  label: string;
  /** Where `/` puts the focus. */
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [draft, setDraft] = useState('');
  const settle = useDebouncedCallback(onChange, CORE_CONFIG.input.searchDebounceMs);
  const type = (next: string) => {
    setDraft(next);
    settle(next);
  };

  return (
    <label className="flex h-8.5 w-65 max-w-full items-center gap-2 rounded-pill bg-hover-surface px-3 text-fg-subtle">
      <Search className="size-3.5" aria-hidden />
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => type(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          type('');
          event.currentTarget.blur();
        }}
        placeholder={label}
        aria-label={label}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-fg-subtle"
      />
    </label>
  );
}
