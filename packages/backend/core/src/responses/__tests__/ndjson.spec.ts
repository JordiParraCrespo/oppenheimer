import { describe, expect, it } from 'vitest';
import { ndjsonLines } from '../ndjson';

/**
 * `ndjsonLines` writes a paged read as one JSON record per line, in order,
 * whatever the page sizes, and nothing at all for an empty read: a reader
 * parses each line on its own.
 */
async function* pages<T>(...chunks: T[][]): AsyncIterable<T[]> {
  for (const chunk of chunks) yield chunk;
}

async function collect(lines: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const line of lines) text += line;
  return text;
}

describe('ndjsonLines', () => {
  it('writes each item as one shaped JSON line, across pages, in order', async () => {
    const text = await collect(
      ndjsonLines(
        pages(
          [
            { id: 1, secret: 'x' },
            { id: 2, secret: 'y' },
          ],
          [],
          [{ id: 3, secret: 'z' }],
        ),
        (item) => ({
          id: item.id,
          note: 'line\nbreak',
        }),
      ),
    );
    const lines = text.split('\n');
    expect(lines.pop()).toBe('');
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      { id: 1, note: 'line\nbreak' },
      { id: 2, note: 'line\nbreak' },
      { id: 3, note: 'line\nbreak' },
    ]);
    expect(text).not.toContain('secret');
  });

  it('writes nothing for an empty read', async () => {
    expect(await collect(ndjsonLines(pages<number>(), (item) => item))).toBe('');
  });
});
