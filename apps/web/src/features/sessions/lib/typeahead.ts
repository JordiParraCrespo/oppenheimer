import type { IBufferCell, IDisposable, Terminal } from '@xterm/xterm';
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
 * cell, two of them) predicts nothing.
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
  let cursorVisible = true;
  const trackCursor = (visible: boolean) => (params: (number | number[])[]) => {
    if (params.some((param) => param === 25)) cursorVisible = visible;
    // Seen, not handled: xterm still applies the mode.
    return false;
  };
  const onShow = term.parser.registerCsiHandler({ prefix: '?', final: 'h' }, trackCursor(true));
  const onHide = term.parser.registerCsiHandler({ prefix: '?', final: 'l' }, trackCursor(false));

  const nullCell = term.buffer.active.getNullCell();
  const cellAt = (row: number, col: number): IBufferCell | undefined => {
    const buffer = term.buffer.active;
    return buffer.getLine(buffer.viewportY + row)?.getCell(col, nullCell);
  };

  const screen: TypeaheadScreen = {
    get cols() {
      return term.cols;
    },
    cursor() {
      const buffer = term.buffer.active;
      // A reader scrolled back is reading, not typing at the prompt.
      if (buffer.viewportY !== buffer.baseY) return null;
      if (cursorVisible) return { row: buffer.cursorY, col: buffer.cursorX };
      return inverseCursor();
    },
    cell(row, col) {
      const cell = cellAt(row, col);
      return { char: cell?.getChars() || ' ', wide: (cell?.getWidth() ?? 1) !== 1 };
    },
  };

  const inverseCursor = (): { row: number; col: number } | null => {
    for (let row = term.rows - 1; row >= 0; row -= 1) {
      let found: number | null = null;
      let count = 0;
      for (let col = 0; col < term.cols; col += 1) {
        if (cellAt(row, col)?.isInverse()) {
          count += 1;
          found = col;
        }
      }
      if (count === 1 && found !== null) return { row, col: found };
      if (count > 1) return null;
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
    const cellWidth = (screenElement?.clientWidth ?? 0) / term.cols;
    const cellHeight = (screenElement?.clientHeight ?? 0) / term.rows;
    if (cellWidth === 0 || cellHeight === 0) return;
    const font = `${term.options.fontSize ?? 13}px ${term.options.fontFamily ?? 'monospace'}`;
    const glyph = Math.min(glyphHeight(font), cellHeight);
    const padTop = Math.floor((cellHeight - glyph) / 2);
    // The cursor looks like the one it stands in for: the terminal's caret, or
    // the inverse cell an Ink program paints.
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

  // xterm centres a glyph's own height in the taller cell (lineHeight 1.3);
  // CSS line-height centres differently, two pixels higher at 13px. So the
  // glyph box is measured once per font and padded down the way xterm does.
  let measured: { font: string; height: number } | null = null;
  const glyphHeight = (font: string): number => {
    if (measured?.font === font) return measured.height;
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;line-height:normal;font:${font}`;
    probe.textContent = 'W';
    overlay.appendChild(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    measured = { font, height };
    return height;
  };

  const redraw = () => draw(options.shouldDraw() ? model.view() : null);

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
      redraw();
    },
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      if (expiry !== null) clearTimeout(expiry);
      onShow.dispose();
      onHide.dispose();
      onParsed.dispose();
      onResize.dispose();
      overlay.remove();
    },
  };
}
