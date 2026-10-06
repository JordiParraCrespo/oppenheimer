import { shareEntities } from '@oppenheimer/frontend-core/react';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Write each row a list read returned into that row's detail, so opening one
 * from the list renders on the click. A detail read after the list was asked
 * for (`askedAt`) is as new or newer and is left alone, and a row that changed
 * nothing keeps the detail's identity, so an open screen is not re-rendered.
 */
export function seedDetails<TRow extends { id: string }>(
  queryClient: QueryClient,
  rows: readonly TRow[],
  detailKey: (id: string) => QueryKey,
  askedAt: number,
): void {
  for (const row of rows) {
    const key = detailKey(row.id);
    if ((queryClient.getQueryState(key)?.dataUpdatedAt ?? 0) >= askedAt) continue;
    queryClient.setQueryData<TRow>(key, (current) => shareEntities(current, row));
  }
}
