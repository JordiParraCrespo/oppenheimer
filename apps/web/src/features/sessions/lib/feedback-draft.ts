import { type ChatFeedbackDraft, readFeedbackDraft } from '@oppenheimer/frontend-consumer';
import type { Terminal } from '@xterm/xterm';
import { watchScreen } from './screen-watch';

/**
 * Reads the card of drafted feedback Claude Code shows over its input box as
 * output lands, and hands it to `onFeedback` (`readFeedbackDraft`): none once
 * it is gone. Only the screen's rows are read, never the scrollback.
 */
export function bindFeedbackDraft(
  term: Terminal,
  onFeedback: (feedback: ChatFeedbackDraft | null) => void,
): () => void {
  const stop = watchScreen(term, () => {
    const buffer = term.buffer.active;
    // A row xterm wrapped onto is joined to the one it continues: the card
    // is read as the lines Claude Code wrote, whatever the pane's width.
    // Rows are read untrimmed and trimmed once joined, so a space the wrap
    // fell on stays between the words it separates.
    const rows: string[] = [];
    for (let row = 0; row < term.rows; row++) {
      const line = buffer.getLine(buffer.baseY + row);
      const text = line?.translateToString(false) ?? '';
      if (line?.isWrapped && rows.length > 0) rows[rows.length - 1] += text;
      else rows.push(text);
    }
    onFeedback(readFeedbackDraft(rows.map((row) => row.trimEnd())));
  });
  return () => {
    stop();
    onFeedback(null);
  };
}
