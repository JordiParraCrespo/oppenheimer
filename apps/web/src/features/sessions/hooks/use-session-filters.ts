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
  // A pick dropped while drawing is dropped from state too, in this render,
  // so it cannot come back with its value in the same visit.
  if (kept !== JSON.stringify(stored)) setStored(filters);

  // localStorage: the filters as drawn, for the next visit on this device.
  useEffect(() => rememberSessionFilters(kept), [kept]);

  const update = (next: (current: SessionFilters) => SessionFilters) =>
    setStored((current) => next(withinOptions(current, options)));

  return [filters, update] as const;
}
