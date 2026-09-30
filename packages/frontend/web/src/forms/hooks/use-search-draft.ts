import { useDebouncedCallback } from '@oppenheimer/design-system-web';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { useState } from 'react';

/**
 * The search-field policy, in one place: the half-typed word is local, it
 * leaves once typing settles, and the field ignores the echo of its own commit.
 * A search field that hands a list its query runs on this; one that should
 * feel different gets different markup, not a second copy.
 *
 * `value` is for a field whose settled value lives outside it (a URL param).
 * A followed link, cleared filter or back button changes it without typing,
 * and the field follows; the echo of its own commit looks identical, so the
 * hook remembers what it last sent up and ignores that one string. Without
 * that, a delayed echo lands the old burst on a reader who kept typing and the
 * caret snaps backwards.
 *
 * Omit `value` when nothing feeds a settled value back down
 * (`SidebarSearchField`); `draft` is then the field's own from first render.
 */
export function useSearchDraft({
  value,
  onChange,
  delay = CORE_CONFIG.input.searchDebounceMs,
}: {
  /** The settled value, when something outside the field owns it. */
  value?: string;
  /** Called with a settled value, once per burst of typing. */
  onChange: (value: string) => void;
  /**
   * How long the field holds a keystroke before it becomes a query. The field
   * owns this, not whatever asked for the results: a burst of keystrokes costs
   * one render of one input rather than one render of everything downstream.
   */
  delay?: number;
}): { draft: string; type: (next: string) => void } {
  const [draft, setDraft] = useState(value ?? '');

  // Adjusting state to a prop, the way React documents it rather than with an
  // effect. `externalRevision` invalidates a pending timer only for genuine
  // outside changes, never for an echo while the reader has carried on typing.
  const [sync, setSync] = useState({
    settled: value,
    emitted: null as string | null,
    externalRevision: 0,
  });
  if (value !== undefined && sync.settled !== value) {
    const isEcho = value === sync.emitted;
    setSync({
      settled: value,
      emitted: null,
      externalRevision: sync.externalRevision + (isEcho ? 0 : 1),
    });
    if (!isEcho) setDraft(value);
  }

  const commit = useDebouncedCallback(
    (next: string) => {
      setSync((current) => ({ ...current, emitted: next }));
      onChange(next);
    },
    delay,
    sync.externalRevision,
  );

  return {
    draft,
    type: (next: string) => {
      setDraft(next);
      commit(next);
    },
  };
}
