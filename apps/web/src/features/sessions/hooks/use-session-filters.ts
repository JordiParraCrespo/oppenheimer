import { useEffect, useState } from 'react';
import { rememberSessionFilters, storedSessionFilters } from '../lib/session-filter-memory';
import type { SessionFilters } from '../lib/session-filters';

/**
 * The sidebar's filters and sort, and their setter. They outlive a reload on
 * this device, like a hidden project or Pinned only.
 */
export function useSessionFilters() {
  const [filters, setFilters] = useState<SessionFilters>(storedSessionFilters);

  // localStorage: the filters as last left, for the next visit on this device.
  useEffect(() => rememberSessionFilters(filters), [filters]);

  return [filters, setFilters] as const;
}
