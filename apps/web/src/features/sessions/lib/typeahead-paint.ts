import type { Terminal } from '@xterm/xterm';
import type { TerminalRendererKind } from './terminal-renderer';
import type { TypeaheadView } from './typeahead-model';

/** The colours a predicted cell is drawn in, as CSS colours. */
export interface TypeaheadColors {
  background: string;
  foreground: string;
  cursor: string;
  cursorText: string;
}

/** How one paint draws its cells, the cursor's look resolved. */
interface PaintColors {
  background: string;
  foreground: string;
  cursorBackground: string;
  cursorText: string;
  /** The caret is a bar this many CSS pixels wide, in `cursorBackground`; `null` for a block. */
  bar: number | null;
}

interface Painter {
  paint(view: TypeaheadView, colors: PaintColors, box: DOMRect): void;
  clear(): void;
  dispose(): void;
}

/**
 * Draws a prediction over `screen` exactly where the renderer in use would
 * draw the same letters, so the host's echo lands on them without moving.
 *
 * Where a glyph sits in its cell is the renderer's, and the two disagree:
 * the DOM renderer is CSS text in rows whose `line-height` is the cell, and
 * WebGL rasterizes each glyph on a canvas with its own baseline rule. Drawn
 * any third way, a guess sat a pixel or two above the echo that replaced it,
 * and the letter visibly dropped into place. So each renderer gets a painter
 * that draws the way it does, chosen again on `repaint` from `renderer` (the
 * renderer switching, a face finishing its load).
 */
export function createTypeaheadPainter(
  term: Terminal,
  screen: HTMLElement | null | undefined,
  renderer: () => TerminalRendererKind,
): {
  /** `caret`: the program shows the terminal's cursor, rather than painting an inverse cell. */
  paint(view: TypeaheadView | null, colors: TypeaheadColors, caret: boolean): void;
  repaint(): void;
  dispose(): void;
} {
  const choose = (): Painter | null => {
    if (!screen) return null;
    return renderer() === 'webgl' ? canvasPainter(term, screen) : domPainter(term, screen);
  };
  let painter = choose();
  let drawn = false;

  return {
    paint(view, colors, caret) {
      if (!view || view.cells.length === 0) {
        if (drawn) painter?.clear();
        drawn = false;
        return;
      }
      // The screen's own box, which xterm sizes to the fractional cell it
      // draws in: `clientWidth` rounds it, and a guess drifted off the host's
      // columns the further right it was typed.
      const box = screen?.getBoundingClientRect();
      if (!painter || !box || box.width === 0 || box.height === 0) return;
      // The cursor looks like the one it stands in for: the terminal's caret,
      // a bar as the terminal draws it, or the inverse cell an Ink program
      // paints. The caret's shape is the terminal's option, not a shape a
      // program asked for: the host's cursor is hidden while a guess shows.
      const bar =
        caret && term.options.cursorStyle === 'bar' ? (term.options.cursorWidth ?? 1) : null;
      painter.paint(
        view,
        {
          background: colors.background,
          foreground: colors.foreground,
          cursorBackground: caret ? colors.cursor : colors.foreground,
          cursorText: caret ? colors.cursorText : colors.background,
          bar,
        },
        box,
      );
      drawn = true;
    },
    repaint() {
      painter?.dispose();
      painter = choose();
      drawn = false;
    },
    dispose() {
      painter?.dispose();
    },
  };
}

/** A DOM cell's colours: a block cursor inverts it, a bar is an inset edge. */
function cellStyle(cursor: boolean, colors: PaintColors): string[] {
  if (cursor && colors.bar === null) {
    return [`background:${colors.cursorBackground}`, `color:${colors.cursorText}`];
  }
  const style = [`background:${colors.background}`, `color:${colors.foreground}`];
  if (cursor) style.push(`box-shadow:inset ${colors.bar}px 0 0 ${colors.cursorBackground}`);
  return style;
}

function cssFont(term: Terminal, size: number): string {
  return `${term.options.fontWeight ?? 'normal'} ${size}px ${term.options.fontFamily ?? 'monospace'}`;
}

/** CSS text in a cell laid out as xterm's DOM renderer lays out its rows. */
function domPainter(term: Terminal, screen: HTMLElement): Painter {
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;';
  screen.appendChild(layer);
  return {
    paint(view, colors, box) {
      const cellWidth = box.width / term.cols;
      const cellHeight = box.height / term.rows;
      const font = cssFont(term, term.options.fontSize ?? 13);
      while (layer.childElementCount > view.cells.length) layer.lastElementChild?.remove();
      while (layer.childElementCount < view.cells.length) {
        layer.appendChild(document.createElement('span'));
      }
      view.cells.forEach((cell, index) => {
        const span = layer.children[index] as HTMLElement;
        span.textContent = cell.char;
        span.style.cssText = [
          'position:absolute',
          'white-space:pre',
          'overflow:hidden',
          `left:${cell.col * cellWidth}px`,
          `top:${view.row * cellHeight}px`,
          `width:${Math.ceil(cellWidth)}px`,
          `height:${cellHeight}px`,
          // After `font`, whose shorthand resets the line height.
          `font:${font}`,
          `line-height:${cellHeight}px`,
          ...cellStyle(cell.cursor, colors),
        ].join(';');
      });
    },
    clear() {
      layer.replaceChildren();
    },
    dispose() {
      layer.remove();
    },
  };
}

/**
 * A canvas drawing each glyph the way `@xterm/addon-webgl` rasterizes it: the
 * ideographic baseline (Firefox: bottom) at the foot of a character box
 * `ceil(height × dpr)` device pixels tall, centred in the cell with `round`,
 * where the height is the face's font bounding box (xterm's
 * `CharSizeService`) and the cell is `floor(box × lineHeight)`.
 */
function canvasPainter(term: Terminal, screen: HTMLElement): Painter {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:6;';
  screen.appendChild(canvas);
  const context = canvas.getContext('2d');

  const metrics = (() => {
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return null;
    probe.font = `${term.options.fontSize ?? 13}px ${term.options.fontFamily ?? 'monospace'}`;
    return probe.measureText('W');
  })();
  const charHeight =
    (metrics?.fontBoundingBoxAscent ?? 0) + (metrics?.fontBoundingBoxDescent ?? 0) ||
    (term.options.fontSize ?? 13);
  const lineHeight = term.options.lineHeight ?? 1;
  const textBaseline: CanvasTextBaseline = navigator.userAgent.includes('Firefox')
    ? 'bottom'
    : 'ideographic';

  return {
    paint(view, colors, box) {
      if (!context) return;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(box.width * dpr);
      const height = Math.round(box.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${box.width}px`;
        canvas.style.height = `${box.height}px`;
      } else {
        context.clearRect(0, 0, width, height);
      }
      const deviceChar = Math.ceil(charHeight * dpr);
      const cellHeight = Math.floor(deviceChar * lineHeight);
      const charTop = lineHeight === 1 ? 0 : Math.round((cellHeight - deviceChar) / 2);
      const cellWidth = width / term.cols;
      const top = view.row * cellHeight;
      context.font = cssFont(term, (term.options.fontSize ?? 13) * dpr);
      context.textBaseline = textBaseline;
      for (const cell of view.cells) {
        const left = Math.floor(cell.col * cellWidth);
        const right = Math.ceil((cell.col + 1) * cellWidth);
        const block = cell.cursor && colors.bar === null;
        context.fillStyle = block ? colors.cursorBackground : colors.background;
        context.fillRect(left, top, right - left, cellHeight);
        context.fillStyle = block ? colors.cursorText : colors.foreground;
        context.fillText(cell.char, cell.col * cellWidth, top + charTop + deviceChar);
        if (cell.cursor && colors.bar !== null) {
          context.fillStyle = colors.cursorBackground;
          context.fillRect(left, top, Math.max(1, Math.round(colors.bar * dpr)), cellHeight);
        }
      }
    },
    clear() {
      context?.clearRect(0, 0, canvas.width, canvas.height);
    },
    dispose() {
      canvas.remove();
    },
  };
}
