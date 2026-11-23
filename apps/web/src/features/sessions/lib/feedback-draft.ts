import { type ChatFeedbackDraft, readFeedbackDraft } from '@oppenheimer/frontend-consumer';
import type { Terminal } from '@xterm/xterm';
import { watchScreen } from './screen-watch';

/**
 * Reads the card of drafted feedback Claude Code shows over its input box as
 * output lands, and hands it to `onFeedback` (`readFeedbackDraft`): none once
 * it is gone. Only the screen's rows are read, never the scrollback, row by
 * row as the card lays them out.
 */
export function bindFeedbackDraft(
  term: Terminal,
  onFeedback: (feedback: ChatFeedbackDraft | null) => void,
): () => void {
  const stop = watchScreen(term, () => {
    const buffer = term.buffer.active;
    const rows: string[] = [];
    for (let row = 0; row < term.rows; row++) {
      rows.push(buffer.getLine(buffer.baseY + row)?.translateToString(true) ?? '');
    }
    onFeedback(readFeedbackDraft(rows));
  });
  return () => {
    stop();
    onFeedback(null);
  };
}
