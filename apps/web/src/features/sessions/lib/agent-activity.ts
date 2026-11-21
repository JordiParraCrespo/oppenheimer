import { type ChatActivity, readAgentActivity } from '@oppenheimer/frontend-consumer';
import type { Terminal } from '@xterm/xterm';
import { watchScreen } from './screen-watch';

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
  const stop = watchScreen(term, () => {
    const buffer = term.buffer.active;
    // A row xterm wrapped onto is joined to the one it continues, so a
    // spinner line wider than the grid reads as the one line it is.
    const rows: string[] = [];
    for (let row = 0; row < term.rows; row++) {
      const line = buffer.getLine(buffer.baseY + row);
      const text = line?.translateToString(true) ?? '';
      if (line?.isWrapped && rows.length > 0) rows[rows.length - 1] += text;
      else rows.push(text);
    }
    onActivity(readAgentActivity(rows));
  });
  return () => {
    stop();
    onActivity(null);
  };
}
