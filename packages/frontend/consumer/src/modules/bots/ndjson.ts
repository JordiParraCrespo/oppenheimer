/**
 * Newline-delimited JSON read off a response body as it arrives: the bytes
 * decoded, cut at each newline, and each complete line parsed and handed on
 * before the next is read. Only the line being received is buffered, so a
 * long stream is never held whole. A blank line is skipped; a line that is
 * not JSON throws.
 */
export async function* readNdjson(stream: ReadableStream<Uint8Array>): AsyncIterable<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline = pending.indexOf('\n');
      while (newline !== -1) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line) yield JSON.parse(line);
        newline = pending.indexOf('\n');
      }
      if (done) break;
    }
    const last = pending.trim();
    if (last) yield JSON.parse(last);
  } finally {
    reader.releaseLock();
  }
}
