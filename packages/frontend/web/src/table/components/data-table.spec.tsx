import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DataTableProps } from '../lib/data-table-types';
import { DataTable } from './data-table';

/**
 * The selection belongs to the rows on screen. Leaving the page drops it, and
 * that drop is final: coming back to the same page must not resurrect rows the
 * reader ticked before they left, or a bulk action would carry keys they no
 * longer have in front of them.
 */

type Row = { id: string; name: string };

const columns = [{ key: 'name', label: 'Name', render: (row: Row) => row.name }];
const rows: Row[] = [
  { id: 'a', name: 'Ada' },
  { id: 'b', name: 'Bob' },
];

type BulkActions = NonNullable<DataTableProps<Row>['bulkActions']>;

function renderTable(page: number, bulkActions: BulkActions) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getKey={(row) => row.id}
      pagination={{ page, pageSize: 2, total: 4, totalPages: 2, onPageChange: () => {} }}
      bulkActions={bulkActions}
      emptyLabel="empty"
    />
  );
}

describe('DataTable selection', () => {
  it('drops the selection when the query moves and does not restore it on return', () => {
    const bulkActions = vi.fn<BulkActions>(() => null);
    const { rerender } = render(renderTable(1, bulkActions));

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'table.selectRow' })[0]);
    expect(bulkActions).toHaveBeenLastCalledWith(['a'], expect.any(Function));

    bulkActions.mockClear();
    rerender(renderTable(2, bulkActions));
    expect(bulkActions).not.toHaveBeenCalled();

    rerender(renderTable(1, bulkActions));
    expect(bulkActions).not.toHaveBeenCalled();
    for (const box of screen.getAllByRole('checkbox', { name: 'table.selectRow' })) {
      expect(box.getAttribute('aria-checked')).toBe('false');
    }
  });
});
