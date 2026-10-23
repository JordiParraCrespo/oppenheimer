/** The media type of newline-delimited JSON: one JSON value per line. */
export const NDJSON_CONTENT_TYPE = 'application/x-ndjson';

/**
 * A paged read as newline-delimited JSON, one record per line, written as
 * the pages arrive. Each line stands alone, so there is no framing to get
 * wrong and a reader can act on a line before the next one is read.
 * `toRecord` shapes each item (a mapper's `toResponse`); the result must be
 * JSON-serialisable.
 */
export async function* ndjsonLines<T>(
  pages: AsyncIterable<readonly T[]>,
  toRecord: (item: T) => unknown,
): AsyncIterable<string> {
  for await (const page of pages) {
    for (const item of page) yield `${JSON.stringify(toRecord(item))}\n`;
  }
}
