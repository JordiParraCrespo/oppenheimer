import type { Terminal } from '@xterm/xterm';

/**
 * How often the screen is read at most: a quarter second is current for what
 * the chat reads off it (the spinner moves once a second, a suggestion lands
 * once a turn) without reading the grid for every chunk a busy agent writes.
 */
const READ_EVERY_MS = 250;

/**
 * Calls `read` once output has landed and gone quiet for a moment, at most
 * every `READ_EVERY_MS`, until the returned function stops it. What a reader
 * takes off the grid is its own; this owns only when it looks.
 */
export function watchScreen(term: Terminal, read: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const parsed = term.onWriteParsed(() => {
    timer ??= setTimeout(() => {
      timer = null;
      read();
    }, READ_EVERY_MS);
  });
  return () => {
    parsed.dispose();
    if (timer !== null) clearTimeout(timer);
  };
}
