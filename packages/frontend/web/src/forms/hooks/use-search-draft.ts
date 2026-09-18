import { useState } from 'react';
import { useDebouncedCallback } from './use-debounced-callback';

/**
 * How long a search field holds a keystroke before it becomes a query.
 *
 * The field owns this, not whatever asked for the results: what a reader types
 * is the field's state until it settles, so a burst of keystrokes costs one
 * render of one input rather than one render of everything downstream.
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The search-field policy, in one place: the half-typed word is local, it
 * leaves once typing settles, and the field ignores the echo of its own commit.
 *
 * Every search field in the apps runs on this. There was briefly a second
 * implementation — a dialog's permission search with its own debounce and no
 * echo rule — and two implementations of one policy is exactly how the last
 * stray debounce survived a refactor. If a field needs to feel different, give
 * it different markup, not a second copy of this.
 *
 * `value` is for a field whose settled value lives somewhere outside it — the
 * URL, in the table's case. A followed link, a cleared filter or a back button
 * changes it without anyone typing, and the field has to follow. What it must
 * *not* follow is the echo of its own commit: those two look identical from
 * here, so the hook remembers what it last sent up and ignores that one string
 * coming back. Without it, any delay between the commit and the value
 * returning lands the old burst on a reader who has carried on typing, and the
 * caret string snaps backwards.
 *
 * Omit `value` when nothing feeds a settled value back down (a dialog that
 * filters a list it already holds). There is then no echo to ignore and no
 * outside change to follow, and `draft` is the field's own from first render.
 */
export function useSearchDraft({
  value,
  onChange,
  delay = SEARCH_DEBOUNCE_MS,
}: {
  /** The settled value, when something outside the field owns it. */
  value?: string;
  /** Called with a settled value, once per burst of typing. */
  onChange: (value: string) => void;
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
