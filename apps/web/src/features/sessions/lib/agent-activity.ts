import { type ChatActivity, readAgentActivity } from '@oppenheimer/frontend-consumer';
import type { Terminal } from '@xterm/xterm';

/**
 * How often the screen is read for the spinner at most: it moves once a
 * second (its clock) and on each new word, so a quarter second is current
 * without reading the grid for every chunk a busy agent writes.
 */
const READ_EVERY_MS = 250;

/**
 * Reads the agent's spinner line off the grid as output lands, and hands
 * what it says to `onActivity` (`readAgentActivity`): none once it is gone.
 * Only the screen's rows are read, never the scrollback, so a spinner the
 * agent left behind in its history is not taken for one running now.
 */
export function bindAgentActivity(
  term: Terminal,
  onActivity: (activity: ChatActivity | null) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const read = () => {
    timer = null;
    const buffer = term.buffer.active;
    const rows: string[] = [];
    for (let row = 0; row < term.rows; row++) {
      rows.push(buffer.getLine(buffer.baseY + row)?.translateToString(true) ?? '');
    }
    onActivity(readAgentActivity(rows));
  };
  const parsed = term.onWriteParsed(() => {
    timer ??= setTimeout(read, READ_EVERY_MS);
  });
  return () => {
    parsed.dispose();
    if (timer !== null) clearTimeout(timer);
    onActivity(null);
  };
}
