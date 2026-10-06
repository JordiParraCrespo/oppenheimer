import { useDebouncedCallback } from '@oppenheimer/design-system-web';
import { Search } from '@oppenheimer/design-system-web/icons';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { useState } from 'react';

/**
 * The queue's search box. It owns the half-typed word and hands the table the
 * settled one, once per burst of typing, so a keystroke renders this field and
 * not the rows. Escape clears it.
 */
export function QueueSearchField({
  onChange,
  label,
}: {
  onChange: (query: string) => void;
  label: string;
}) {
  const [draft, setDraft] = useState('');
  const settle = useDebouncedCallback(onChange, CORE_CONFIG.input.searchDebounceMs);
  const type = (next: string) => {
    setDraft(next);
    settle(next);
  };

  return (
    <label className="flex h-8 w-65 max-w-full items-center gap-2 rounded-pill bg-hover-surface px-3 text-fg-subtle">
      <Search className="size-3.5" aria-hidden />
      <input
        value={draft}
        onChange={(event) => type(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') type('');
        }}
        placeholder={label}
        aria-label={label}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-fg-subtle"
      />
    </label>
  );
}
