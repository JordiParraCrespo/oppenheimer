import { useEffect } from 'react';

/**
 * Sends a table back to its last real page once the answer shows there is no
 * page where the URL points.
 *
 * A page past the end of the list is reachable now that the page lives in the
 * URL: a link shared before rows were deleted, or a hand-typed `?page=100`.
 * The server answers it with nothing, and the footer reads "595–12 of 12"
 * under "Page 100 of 2" — while the only way back to real rows is clicking
 * Previous ninety-eight times.
 *
 * This is a correction of the URL in response to data arriving, which no
 * event handler sees, so it is an effect — the one place in the table that
 * needs one. Not while loading: `totalPages` is then either the previous
 * query's or the caller's fallback of 1, and clamping to that would throw the
 * reader to page 1 on every refetch. `lastPage` is floored at 1 by the caller,
 * which is what stops an empty result (`totalPages: 0`) from setting a page
 * the floor immediately raises again, forever.
 */
export function useClampedPage({
  page,
  lastPage,
  isLoading,
  onPageChange,
}: {
  page: number;
  lastPage: number;
  isLoading: boolean | undefined;
  onPageChange: (page: number) => void;
}): void {
  useEffect(() => {
    if (!isLoading && page > lastPage) onPageChange(lastPage);
  }, [isLoading, page, lastPage, onPageChange]);
}
