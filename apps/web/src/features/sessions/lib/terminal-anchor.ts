/**
 * Bottom-anchoring: the agent's prompt sits on the pane's last rows, the way a
 * chat composer does, rather than under the banner with the rest of the pane
 * blank below it.
 *
 * A terminal fills from the top. A fresh session is a banner and a prompt box
 * on the first dozen rows of a forty-row grid, and after `clear` a shell is one
 * line at the very top. The grid is the program's — tmux paints every row, and
 * the agent decides where its prompt goes — so nothing is moved *in* it; the
 * console only moves the grid's picture down by however many rows below the
 * content are empty, and the pane's own clipping hides the empty rows that
 * slide out of view. When output fills the screen the offset is zero and the
 * terminal is exactly what it always was.
 *
 * It is a picture moved with a CSS transform, so the PTY's size, the program's
 * idea of where its cursor is and xterm's mouse and selection maths (which read
 * the transformed rectangle) are all untouched.
 */

/** The slice of an xterm buffer this reads, so the rule is testable without a DOM. */
export interface AnchorBuffer {
  /** Rows in the grid. */
  rows: number;
  /** The first line of the screen, as a buffer index (`baseY`). */
  baseY: number;
  /** The first line of the viewport, as a buffer index (`viewportY`). */
  viewportY: number;
  /** The cursor's row on the screen, 0-based. */
  cursorY: number;
  /** One screen row's text with trailing whitespace trimmed; `''` for an empty row. */
  rowText(y: number): string;
}

/**
 * How many rows at the bottom of the screen are empty — below the last row
 * with anything on it and below the cursor — which is how far the picture
 * moves down.
 *
 * Zero whenever the reader has scrolled back: they are reading history, and a
 * picture that shifted under them as output arrived would lose their place.
 */
export function emptyRowsBelowContent(buffer: AnchorBuffer): number {
  if (buffer.rows < 1 || buffer.viewportY !== buffer.baseY) return 0;
  let last = Math.min(Math.max(buffer.cursorY, 0), buffer.rows - 1);
  for (let y = buffer.rows - 1; y > last; y -= 1) {
    if (buffer.rowText(y).trim() !== '') {
      last = y;
      break;
    }
  }
  return buffer.rows - 1 - last;
}
