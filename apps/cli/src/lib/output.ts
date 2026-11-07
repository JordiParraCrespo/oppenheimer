/**
 * Terminal output. Two modes, chosen with `--json`:
 *
 * - human: aligned tables and short summaries
 * - json: the API payload, unchanged, so `jq` and scripts get a stable shape
 *
 * Colour is skipped when stdout is not a TTY or `NO_COLOR` is set.
 */

import type { SessionTranscriptPage } from './api-types';

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

/** Why nothing was read, in the words `opp` prints. */
const REASONS: Record<NonNullable<SessionTranscriptPage['reason']>, string> = {
  cloud_vendor: 'it runs in its vendor’s cloud, and its conversation is kept there',
  agent_keeps_none: 'its agent keeps no transcript Oppenheimer can read',
  runner_too_old: 'its host’s runner is too old; update it with `runner update`',
  host_offline: 'its host is offline',
  timed_out: 'its host did not answer in time',
  host_refused: 'its host refused the read',
};

/**
 * The agent's words made safe for a terminal: an escape sequence a tool
 * printed (or an agent wrote) would otherwise move the cursor, rewrite what
 * is on screen or set the window title. Newlines and tabs stay.
 */
export function printable(text: string | null): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what this removes
  return (text ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '');
}

/**
 * A page of a session's conversation as `opp sessions transcript` prints it:
 * one block per entry, then how complete the page is and the command that
 * reads on. The text is the agent's and its tools': printed, never run.
 */
export function describeTranscript(id: string, page: SessionTranscriptPage): string {
  if (page.status === 'unsupported' || page.status === 'unavailable') {
    const why = page.reason ? REASONS[page.reason] : 'it could not be read';
    const where = page.vendorUrl ? `\nRead it at ${printable(page.vendorUrl)}` : '';
    return `${style.yellow('!')} The conversation cannot be read here: ${why}.${where}`;
  }
  const lines = page.entries.map(
    (entry) =>
      `${style.dim(formatDate(entry.at))} ${style.bold(entry.role)}\n  ${entry.parts.map(transcriptPart).join('\n  ')}`,
  );
  if (!lines.length) lines.push(style.dim('Nothing yet.'));
  const notes: string[] = [];
  if (page.restarted) notes.push('The conversation started over, so this reads it from its start.');
  if (page.status === 'partial') {
    notes.push(
      `Partial: something was cut on the host${page.dropped ? `; ${page.dropped} entries left out` : ''}.`,
    );
  }
  if (page.redactions) notes.push(`${page.redactions} secrets replaced with [redacted].`);
  if (page.nextCursor) {
    notes.push(
      `${page.atEnd ? 'That is all so far. Later:' : 'More:'} opp sessions transcript ${id} --cursor ${page.nextCursor}`,
    );
  }
  return [...lines, ...notes.map((note) => style.dim(note))].join('\n');
}

/** One part of an entry, made printable. */
function transcriptPart(part: SessionTranscriptPage['entries'][number]['parts'][number]): string {
  const cut = part.truncated ? style.dim(' (cut on the host)') : '';
  switch (part.kind) {
    case 'text':
      return `${printable(part.text)}${cut}`;
    case 'thinking':
      return style.dim(`(thinking) ${printable(part.text)}`) + cut;
    case 'tool_call':
      return `${style.cyan(`→ ${printable(part.tool) || 'tool'}`)} ${printable(part.text)}${cut}`;
    case 'tool_result':
      return `${part.isError ? style.red('✗ error') : style.dim('← result')} ${printable(part.text)}${cut}`;
    case 'image':
      return style.dim('(an image)');
  }
}
