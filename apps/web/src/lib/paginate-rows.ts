import type { DataTablePagination } from '@/components/data-table';
import type { TableQuery } from '@/lib/use-table-query';

/**
 * Page a list the server hands over whole.
 *
 * `DataTable`'s pagination is controlled because most of its tables are one
 * page of a server-side query — leads, domains and the audit log all ask the
 * API for a page at a time. Members, roles and API tokens are not: those
 * endpoints return everything, so the slice is cut here. Without it a
 * workspace of two hundred members rendered two hundred rows.
 *
 * The page itself is not state this owns — it comes from `useTableQuery`, which
 * keeps it in the URL along with the search and the filters, so a link to page
 * three of the roles table is a link to page three of the roles table.
 *
 * The page is clamped rather than reset, so a search that shrinks the list
 * moves the reader to the last page that exists instead of stranding them on
 * an empty table. Clamping only fixes what is rendered — the URL keeps the
 * page the reader asked for, and going back to a wider query puts them where
 * they were.
 */
export function paginateRows<TRow>(
  rows: TRow[],
  pageSize: number,
  query: Pick<TableQuery<string>, 'page' | 'setPage'>,
): { rows: TRow[]; pagination: DataTablePagination } {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, query.page), totalPages);

  return {
    rows: rows.slice((current - 1) * pageSize, current * pageSize),
    pagination: {
      page: current,
      pageSize,
      total: rows.length,
      totalPages,
      onPageChange: query.setPage,
    },
  };
}
