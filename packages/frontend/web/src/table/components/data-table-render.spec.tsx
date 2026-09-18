import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTable } from './data-table';

/**
 * The table's render budget.
 *
 * Not a test of what the table shows — of what it *costs*. `DataTable` was one
 * 624-line component holding the search field, the selection, every row and the
 * pager, so a keystroke re-rendered all of them: eight rows, forty cells, eight
 * dropdowns and two checkboxes per row, for a query that was debounced anyway
 * and had not been asked yet.
 *
 * These assertions are the thing that keeps it split. They deliberately run
 * under the package's own vitest config, which does **not** enable the React
 * Compiler — so what they measure is the structure, not the build step that
 * used to hide it. A regression here means the live value has leaked back up
 * into a prop of the rows.
 */

type Row = { id: string; name: string };

const rows: Row[] = Array.from({ length: 8 }, (_, index) => ({
  id: String(index),
  name: `Row ${index}`,
}));

/**
 * The real loop, not a stub: what the field emits becomes the committed value
 * and comes back down as a prop, exactly as `useTableQuery` and the URL do it.
 * A spy that swallowed the value would pass on the structure this replaced.
 *
 * `echoDelayMs` models a parent that does not hand the value straight back — a
 * debounced URL write, a slow store. The field must not take that late echo as
 * news once the reader has typed on.
 */
function Harness({
  onCommit,
  onCell,
  echoDelayMs = 0,
}: {
  onCommit: (value: string) => void;
  onCell: () => void;
  echoDelayMs?: number;
}) {
  const [value, setValue] = useState('');

  return (
    <DataTable
      columns={[
        {
          key: 'name',
          label: 'Name',
          render: (row: Row) => {
            onCell();
            return row.name;
          },
        },
      ]}
      rows={rows}
      getKey={(row) => row.id}
      pagination={{ page: 1, pageSize: 8, total: 8, totalPages: 1, onPageChange: () => {} }}
      search={{
        value,
        onChange: (next) => {
          onCommit(next);
          if (echoDelayMs === 0) setValue(next);
          else setTimeout(() => setValue(next), echoDelayMs);
        },
        placeholder: 'Search',
      }}
      emptyLabel="empty"
      actions={[
        // A way for the test to change the settled value from outside the
        // field, the way a cleared facet or a back button would.
        { label: 'clear-external', onClick: () => setValue('') },
        { label: 'set-external', onClick: () => setValue('external') },
        { label: 'set-acme-external', onClick: () => setValue('acme') },
      ]}
    />
  );
}

function setup(echoDelayMs = 0) {
  const cells = { count: 0 };
  const onCommit = vi.fn();

  render(
    <Harness onCommit={onCommit} onCell={() => (cells.count += 1)} echoDelayMs={echoDelayMs} />,
  );

  return { cells, onCommit, field: screen.getByRole('searchbox') };
}

function type(field: HTMLElement, ...values: string[]) {
  for (const value of values) fireEvent.change(field, { target: { value } });
}

/** Lets the field's debounce fire, and React commit what it produced. */
function settle() {
  act(() => {
    vi.advanceTimersByTime(300);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  // This package's vitest config declares no globals and no setup file, so
  // Testing Library's automatic cleanup is never registered — without this the
  // second render finds the first one's search field still in the document.
  cleanup();
  vi.useRealTimers();
});

describe('DataTable render budget', () => {
  it('renders no rows while the reader is typing', () => {
    const { cells, field } = setup();

    cells.count = 0;
    type(field, 'a', 'ac', 'acm', 'acme');

    expect(cells.count).toBe(0);
  });

  it('renders the rows once, when the search settles', () => {
    const { cells, field } = setup();

    cells.count = 0;
    type(field, 'a', 'ac', 'acm', 'acme');
    settle();

    // One pass over the page, not one per character.
    expect(cells.count).toBe(rows.length);
  });

  it('keeps the field live while the rows sit still', () => {
    const { field } = setup();

    fireEvent.change(field, { target: { value: 'acme' } });

    expect((field as HTMLInputElement).value).toBe('acme');
  });

  it('asks for a new query once per burst of typing, not once per character', () => {
    const { onCommit, field } = setup();

    type(field, 'a', 'ac', 'acm', 'acme');
    expect(onCommit).not.toHaveBeenCalled();

    settle();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('acme');
  });

  it('does not let a late echo of its own commit snap the caret string back', () => {
    // The parent takes 200ms to hand the value back — a debounced URL write.
    const { field } = setup(200);

    type(field, 'acme');
    settle();
    // The reader carried on while that was in flight.
    type(field, 'acme corp');
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect((field as HTMLInputElement).value).toBe('acme corp');
  });

  it('still follows a value it did not send, such as a followed link', () => {
    const { field } = setup();

    type(field, 'acme');
    settle();
    expect((field as HTMLInputElement).value).toBe('acme');

    // Something else cleared it — a facet reset, a back button.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'clear-external' }));
    });

    expect((field as HTMLInputElement).value).toBe('');
  });

  it('cancels a pending local commit when navigation supplies a value', () => {
    const { field, onCommit } = setup();

    type(field, 'local draft');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'set-external' }));
    });
    settle();

    expect((field as HTMLInputElement).value).toBe('external');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('follows a later navigation back to a value it previously emitted', () => {
    const { field } = setup();

    type(field, 'acme');
    settle();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'set-external' }));
    });
    expect((field as HTMLInputElement).value).toBe('external');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'set-acme-external' }));
    });

    expect((field as HTMLInputElement).value).toBe('acme');
  });

  it('does not rebuild its query identity while the reader is typing', () => {
    // The identity is what drops a selection when the query moves, and it is
    // recomputed — and committed through a render-phase setState — every time
    // it changes. It used to carry the live search value, so a four-letter word
    // cost four extra render passes over the whole table. The settled value
    // changes once.
    const { cells, field } = setup();

    cells.count = 0;
    type(field, 'a', 'ac', 'acm', 'acme');
    settle();

    expect(cells.count).toBe(rows.length);
  });
});
