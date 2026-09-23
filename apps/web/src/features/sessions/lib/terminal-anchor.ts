import type { Terminal } from '@xterm/xterm';

/**
 * The agent's prompt sits on the pane's last visible rows; a full screen, or a
 * viewport scrolled back, does not move (05).
 *
 * A terminal fills from the top, so a fresh session is a banner and a prompt
 * on the first rows of a tall grid with the rest blank. The grid is the
 * program's, so nothing moves *in* it: what moves is the picture of it.
 *
 * How, today: xterm's screen layer is shifted down by the empty rows below
 * the content, and the pane clips what slides past the grid. Only the screen
 * layer moves — xterm's scrollable element, its scrollbar and the surface
 * that takes clicks and the wheel stay the size of the pane — and xterm reads
 * the screen's transformed rectangle for mouse and selection maths. This
 * leans on xterm's DOM (`.xterm-screen`), which is why it is kept here, next
 * to the rule, and nowhere else.
 */

/** The slice of an xterm buffer the rule reads, so it is testable without a DOM. */
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

/**
 * Clip what the anchor pushes past the grid, on the element xterm is opened
 * in. `clip` rather than `hidden`: a `hidden` box is still a scroll container,
 * and xterm's input textarea follows the cursor, so the moment it took focus
 * the browser scrolled that box to reveal it and undid the shift.
 */
export function clipAnchoredPane(container: HTMLElement): void {
  container.style.overflow = 'clip';
}

/** Put `term`'s content on the last visible rows, or back at the top. */
export function anchorToBottom(term: Terminal): void {
  const screen = term.element?.querySelector<HTMLElement>('.xterm-screen');
  if (!screen || term.rows < 1) return;
  const buffer = term.buffer.active;
  const rows = emptyRowsBelowContent({
    rows: term.rows,
    baseY: buffer.baseY,
    viewportY: buffer.viewportY,
    cursorY: buffer.cursorY,
    rowText: (y) => buffer.getLine(buffer.baseY + y)?.translateToString(true) ?? '',
  });
  // Pixels, not rows: a font change moves the cell height under an unchanged
  // row count.
  const px = Math.round((rows * screen.offsetHeight) / term.rows);
  const transform = px > 0 ? `translateY(${px}px)` : '';
  if (screen.style.transform !== transform) screen.style.transform = transform;
}
