import { type ChatPermissionPrompt, readPermissionPrompt } from '@oppenheimer/frontend-consumer';
import type { PermissionPromptSpec } from '@oppenheimer/shared/sessions';
import type { Terminal } from '@xterm/xterm';
import { watchScreen } from './screen-watch';

/**
 * Reads the permission dialog the agent draws before a tool runs off the
 * grid as output lands, with the agent's spec (`permissionPromptOf`), and
 * hands it to `onPermission` (`readPermissionPrompt`): none once it is gone.
 * Only the screen's rows are read, never the scrollback. A row xterm wrapped
 * onto is joined to the one it continues; the indented rows the agent wraps
 * a long label onto itself stay rows of their own.
 */
export function bindPermissionPrompt(
  term: Terminal,
  spec: PermissionPromptSpec,
  onPermission: (permission: ChatPermissionPrompt | null) => void,
): () => void {
  const stop = watchScreen(term, () => {
    const buffer = term.buffer.active;
    const rows: string[] = [];
    for (let row = 0; row < term.rows; row++) {
      const line = buffer.getLine(buffer.baseY + row);
      const text = line?.translateToString(false) ?? '';
      if (line?.isWrapped && rows.length > 0) rows[rows.length - 1] += text;
      else rows.push(text);
    }
    onPermission(readPermissionPrompt(spec, rows));
  });
  return () => {
    stop();
    onPermission(null);
  };
}
