import type { IBufferCell, IDisposable, Terminal } from '@xterm/xterm';
import { bindHostCursor } from './host-cursor';
import {
  classifyTypeaheadKey,
  TypeaheadModel,
  type TypeaheadScreen,
  type TypeaheadView,
} from './typeahead-model';

/** The colours a predicted cell is drawn in, as CSS colours. */
export interface TypeaheadColors {
  background: string;
  foreground: string;
  cursor: string;
  cursorText: string;
}

export interface TypeaheadOptions {
  /** Whether predictions are drawn right now (the flag, and a host slow enough to need them). */
  shouldDraw: () => boolean;
  readColors: () => TypeaheadColors;
  /** Each guess the host confirmed, with its round trip. */
  onConfirm?: (latencyMs: number) => void;
  /** How long a guess may wait for the host before it is dropped. */
  timeoutMs?: () => number;
}

const DEFAULT_TIMEOUT_MS = 1000;

/**
 * Predictive local echo on `term` (the model is `typeahead-model.ts`): every
 * key the reader sends goes through `input` first, and a key the model can
 * predict is drawn at once in an overlay over the grid, until the host's
 * output agrees or contradicts it.
 *
 * The overlay is ours rather than xterm's decorations because a tmux client
 * sits on the alternate screen, where xterm hides decoration elements; it is
 * the same layer `user-turns.ts` lays its bubbles in, one step above them.
 *
 * Where the cursor is takes two readings, because the agents disagree. A shell
 * and Codex leave the terminal's cursor where the reader types. Claude Code,
 * like every Ink program, hides it and paints its own as one inverse cell, so
 * while the cursor is hidden (DECTCEM, tracked off the parser) the cursor is
 * the one inverse cell on the lowest row that has any. Anything else (no such
 * cell, two of them) predicts nothing. The grid is searched once, when a line
 * is first predicted on; after that only that line's row is read.
 */
export function bindTypeahead(
  term: Terminal,
  options: TypeaheadOptions,
): IDisposable & { input(data: string): void; repaint(): void } {
  const screenElement = term.element?.querySelector<HTMLElement>('.xterm-screen');
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;';
  screenElement?.appendChild(overlay);

  let colors = options.readColors();

  // xterm centres a glyph's own height in the taller cell (lineHeight 1.3);
  // CSS line-height centres differently, two pixels higher at 13px. So the
  // glyph box is measured here, when the overlay is bound, and again on
  // `repaint` (a theme change, a terminal face finishing its load), never
  // while drawing, and padded down the way xterm does.
  const fontOf = () => `${term.options.fontSize ?? 13}px ${term.options.fontFamily ?? 'monospace'}`;
  const measureGlyph = (): number => {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;line-height:normal;font:${fontOf()}`;
    probe.textContent = 'W';
    overlay.appendChild(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  };
  let glyphHeight = measureGlyph();
  // While a prediction is drawn the terminal's own cursor is kept off screen:
  // it marks where the host has got to, a few keys behind, and drawn under the
  // predicted one it read as a second cursor trailing the first, which is the
  // lag the prediction is there to hide.
  const hostCursor = bindHostCursor(term);

  const nullCell = term.buffer.active.getNullCell();
  const cellAt = (row: number, col: number): IBufferCell | undefined => {
    const buffer = term.buffer.active;
    return buffer.getLine(buffer.viewportY + row)?.getCell(col, nullCell);
  };

  const screen: TypeaheadScreen = {
    get cols() {
      return term.cols;
    },
    cursor(row) {
      const buffer = term.buffer.active;
      // A reader scrolled back is reading, not typing at the prompt.
      if (buffer.viewportY !== buffer.baseY) return null;
      if (hostCursor.visible()) return { row: buffer.cursorY, col: buffer.cursorX };
      if (row !== undefined) {
        const col = inverseCellOn(row);
        return col === null || col === 'many' ? null : { row, col };
      }
      return inverseCursor();
    },
    cell(row, col) {
      const cell = cellAt(row, col);
      return { char: cell?.getChars() || ' ', wide: (cell?.getWidth() ?? 1) !== 1 };
    },
  };

  /** The column of the row's one inverse cell, `null` for none, `'many'` for more. */
  const inverseCellOn = (row: number): number | null | 'many' => {
    let found: number | null = null;
    for (let col = 0; col < term.cols; col += 1) {
      if (!cellAt(row, col)?.isInverse()) continue;
      if (found !== null) return 'many';
      found = col;
    }
    return found;
  };

  const inverseCursor = (): { row: number; col: number } | null => {
    for (let row = term.rows - 1; row >= 0; row -= 1) {
      const col = inverseCellOn(row);
      if (col === 'many') return null;
      if (col !== null) return { row, col };
    }
    return null;
  };

  const model = new TypeaheadModel(
    () => performance.now(),
    (latency) => options.onConfirm?.(latency),
  );

  const draw = (view: TypeaheadView | null) => {
    if (!view || view.cells.length === 0) {
      overlay.replaceChildren();
      return;
    }
    // The screen's own box, which xterm sizes to the fractional cell it draws
    // in: `clientWidth` rounds it, and the guess drifted off the host's
    // columns the further right it was typed.
    const box = screenElement?.getBoundingClientRect();
    const cellWidth = (box?.width ?? 0) / term.cols;
    const cellHeight = (box?.height ?? 0) / term.rows;
    if (cellWidth === 0 || cellHeight === 0) return;
    const font = fontOf();
    const padTop = Math.max(0, Math.floor((cellHeight - glyphHeight) / 2));
    // The cursor looks like the one it stands in for: the terminal's caret, or
    // the inverse cell an Ink program paints.
    const cursorVisible = hostCursor.visible();
    const cursorBackground = cursorVisible ? colors.cursor : colors.foreground;
    const cursorText = cursorVisible ? colors.cursorText : colors.background;
    while (overlay.childElementCount > view.cells.length) overlay.lastElementChild?.remove();
    while (overlay.childElementCount < view.cells.length) {
      overlay.appendChild(document.createElement('span'));
    }
    view.cells.forEach((cell, index) => {
      const span = overlay.children[index] as HTMLElement;
      span.textContent = cell.char;
      span.style.cssText = [
        'position:absolute',
        'white-space:pre',
        'overflow:hidden',
        `left:${cell.col * cellWidth}px`,
        `top:${view.row * cellHeight}px`,
        `width:${Math.ceil(cellWidth)}px`,
        `height:${cellHeight}px`,
        `font:${font}`,
        'line-height:normal',
        `padding-top:${padTop}px`,
        'box-sizing:border-box',
        `background:${cell.cursor ? cursorBackground : colors.background}`,
        `color:${cell.cursor ? cursorText : colors.foreground}`,
      ].join(';');
    });
  };

  const redraw = () => {
    const view = options.shouldDraw() ? model.view() : null;
    hostCursor.suppress(Boolean(view && view.cells.length > 0));
    draw(view);
  };

  let expiry: ReturnType<typeof setTimeout> | null = null;
  const scheduleExpiry = () => {
    if (expiry !== null || !model.waiting) return;
    const timeout = options.timeoutMs?.() ?? DEFAULT_TIMEOUT_MS;
    expiry = setTimeout(() => {
      expiry = null;
      model.expire(timeout);
      redraw();
      scheduleExpiry();
    }, timeout / 2);
  };

  // Reconciled once per frame, and never inside a synchronized frame: there
  // the grid is half-way through the host's redraw and would read as a
  // contradiction.
  let frame: number | null = null;
  const reconcile = () => {
    frame = null;
    if (term.modes.synchronizedOutputMode) return;
    model.reconcile(screen);
    redraw();
  };
  const onParsed = term.onWriteParsed(() => {
    frame ??= requestAnimationFrame(reconcile);
  });
  const onResize = term.onResize(() => {
    model.restart();
    redraw();
  });

  return {
    input(data: string) {
      model.key(classifyTypeaheadKey(data), screen);
      redraw();
      scheduleExpiry();
    },
    repaint() {
      colors = options.readColors();
      glyphHeight = measureGlyph();
      redraw();
    },
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      if (expiry !== null) clearTimeout(expiry);
      hostCursor.dispose();
      onParsed.dispose();
      onResize.dispose();
      overlay.remove();
    },
  };
}
