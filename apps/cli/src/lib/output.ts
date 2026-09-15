/**
 * Terminal output. Two modes, chosen with `--json`:
 *
 * - human: aligned tables and short summaries
 * - json: the API payload, unchanged, so `jq` and scripts get a stable shape
 *
 * Colour is skipped when stdout is not a TTY or `NO_COLOR` is set.
 */

const useColour = (): boolean =>
  process.stdout.isTTY === true && !process.env.NO_COLOR && process.env.TERM !== 'dumb';

const wrap = (code: number, text: string): string =>
  useColour() ? `\u001b[${code}m${text}\u001b[0m` : text;

export const style = {
  bold: (text: string) => wrap(1, text),
  dim: (text: string) => wrap(2, text),
  red: (text: string) => wrap(31, text),
  green: (text: string) => wrap(32, text),
  yellow: (text: string) => wrap(33, text),
  cyan: (text: string) => wrap(36, text),
};

export interface Column<T> {
  header: string;
  value: (row: T) => string;
}

/** Render rows as an aligned table. Returns a message when there are none. */
export function table<T>(
  rows: readonly T[],
  columns: readonly Column<T>[],
  empty = 'No results.',
): string {
  if (rows.length === 0) return style.dim(empty);

  const cells = rows.map((row) => columns.map((column) => column.value(row)));
  const widths = columns.map((column, index) =>
    Math.max(column.header.length, ...cells.map((row) => visibleLength(row[index]))),
  );

  const header = columns
    .map((column, index) => style.bold(pad(column.header, widths[index])))
    .join('  ');

  const body = cells.map((row) =>
    row.map((cell, index) => pad(cell, index === row.length - 1 ? 0 : widths[index])).join('  '),
  );

  return [header, ...body].join('\n');
}

/** Print either the JSON payload or the human rendering. */
export function render(json: boolean, payload: unknown, human: () => string): void {
  process.stdout.write(json ? `${JSON.stringify(payload, null, 2)}\n` : `${human()}\n`);
}

export function success(message: string): void {
  process.stdout.write(`${style.green('✓')} ${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`${style.yellow('!')} ${message}\n`);
}

/** Human-readable timestamp, or a dash when absent. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().replace('T', ' ').slice(0, 16);
}

export function formatList(values: readonly string[] | null | undefined, empty = '—'): string {
  return values && values.length > 0 ? values.join(', ') : empty;
}

function pad(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - visibleLength(text)));
}

/** Length ignoring ANSI escapes, so styled cells still line up. */
function visibleLength(text: string): number {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes requires ESC
  return text.replace(/\u001b\[\d+m/g, '').length;
}
