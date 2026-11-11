import { useEffect, useState } from 'react';
import {
  rememberSessionFilters,
  storedSessionFilters,
  withinOptions,
} from '../lib/session-filter-memory';
import type { FilterOption, SessionFacet, SessionFilters } from '../lib/session-filters';

/**
 * The sidebar's filters and sort, and their setter. They outlive a reload on
 * this device, like a hidden project or Pinned only. A pick the menu no
 * longer offers is dropped for good, not hidden: every update starts from
 * the filters as drawn, and those are what is kept, so a repository that
 * comes back later does not bring back a filter the reader stopped seeing.
 */
export function useSessionFilters(options: Record<SessionFacet, FilterOption[]>) {
  const [stored, setStored] = useState<SessionFilters>(storedSessionFilters);
  const filters = withinOptions(stored, options);
  const kept = JSON.stringify(filters);
  // Invariant: state always holds what is drawn. A pick the options dropped
  // is dropped from state too, here in render (React's "adjusting state when
  // a prop changes"; an effect may not derive state), so it cannot come back
  // with its value later in the visit. `withinOptions` of its own result is
  // that result, key order included, so the next render compares equal and
  // this settles after one extra render.
  if (kept !== JSON.stringify(stored)) setStored(filters);

  // localStorage: the filters as drawn, for the next visit on this device.
  useEffect(() => rememberSessionFilters(kept), [kept]);

  const update = (next: (current: SessionFilters) => SessionFilters) =>
    setStored((current) => next(withinOptions(current, options)));

  return [filters, update] as const;
}
