/** A table's cell: a number, words, or nothing. */
export type VisualCell = number | string | null;

export type VisualSort = { column: number; direction: 'asc' | 'desc' } | null;

/**
 * Rows in the order a click on a header asks for: numbers by value, words in
 * the reader's collation (so "item 10" follows "item 9"), empty cells last
 * either way. Rows that compare equal keep the order the agent gave.
 */
export function sortVisualRows<Row extends readonly VisualCell[]>(
  rows: readonly Row[],
  sort: VisualSort,
  locale?: string,
): Row[] {
  if (!sort) return [...rows];
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const sign = sort.direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const x = a.row[sort.column] ?? null;
      const y = b.row[sort.column] ?? null;
      if (x === null || x === '') return y === null || y === '' ? a.index - b.index : 1;
      if (y === null || y === '') return -1;
      const order =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : collator.compare(String(x), String(y));
      return order === 0 ? a.index - b.index : order * sign;
    })
    .map(({ row }) => row);
}

/** The next sort after a click on `column`: ascending, then descending, then as given. */
export function nextVisualSort(current: VisualSort, column: number, numeric: boolean): VisualSort {
  const first = numeric ? 'desc' : 'asc';
  if (!current || current.column !== column) return { column, direction: first };
  if (current.direction === first) return { column, direction: first === 'asc' ? 'desc' : 'asc' };
  return null;
}
