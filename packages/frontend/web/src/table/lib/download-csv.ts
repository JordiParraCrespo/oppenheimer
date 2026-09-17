/**
 * CSV export, in one place.
 *
 * Four screens were doing this by hand and two of them carried their own
 * `csvCell`. The quoting is the part that matters — it is what stands between a
 * lead called "Smith, Jane" and a file with a column too many — so it lives
 * here rather than being re-derived per screen.
 *
 * Exports come in two shapes and both are covered:
 *
 * - **Built here.** Domains and team have the rows on screen already and there
 *   is no export endpoint to call, so they serialise locally —
 *   `downloadCsvRows`.
 * - **Built by the server.** Leads and the audit log answer with a finished CSV
 *   (the audit log records the download as an `audit.exported` event), so they
 *   only need the browser half — `downloadCsv`.
 */

/** RFC 4180: every cell is quoted, and a quote inside one is doubled. */
function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/** Rows to a CSV document. Pass the header already translated. */
export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}

/**
 * Hands a finished CSV to the browser as a download.
 *
 * The object URL is revoked as soon as the click is dispatched — the browser
 * has taken its own reference by then, and holding ours would keep the blob
 * alive for the life of the document.
 */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** `toCsv` then `downloadCsv`, for the screens that serialise their own rows. */
export function downloadCsvRows(
  filename: string,
  header: readonly string[],
  rows: readonly (readonly string[])[],
): void {
  downloadCsv(filename, toCsv(header, rows));
}
