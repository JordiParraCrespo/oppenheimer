import { describe, expect, it } from 'vitest';
import { readNdjson } from '../ndjson';

/**
 * `readNdjson` hands each line of a body on as it is complete, whatever the
 * chunks the network cut it into: a line split across chunks, a multi-byte
 * character split across chunks, several lines in one chunk, a last line with
 * no newline. What breaks it is a reader that parses chunks rather than lines.
 */
function body(...chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const read: unknown[] = [];
  for await (const record of readNdjson(stream)) read.push(record);
  return read;
}

describe('readNdjson', () => {
  it('parses each line once it is whole, across chunk boundaries', async () => {
    expect(await collect(body('{"a":1}\n{"a"', ':2}\n\n{"a":3}\n'))).toEqual([
      { a: 1 },
      { a: 2 },
      { a: 3 },
    ]);
  });

  it('keeps a character whose bytes arrive in two chunks', async () => {
    const bytes = new TextEncoder().encode('{"word":"café"}\n');
    const cut = bytes.length - 3;
    expect(await collect(body(bytes.slice(0, cut), bytes.slice(cut)))).toEqual([{ word: 'café' }]);
  });

  it('reads a last line with no newline, and nothing from an empty body', async () => {
    expect(await collect(body('{"a":1}\n{"a":2}'))).toEqual([{ a: 1 }, { a: 2 }]);
    expect(await collect(body())).toEqual([]);
  });

  it('throws on a line that is not JSON', async () => {
    await expect(collect(body('{"a":1}\nnot json\n'))).rejects.toThrow();
  });
});
