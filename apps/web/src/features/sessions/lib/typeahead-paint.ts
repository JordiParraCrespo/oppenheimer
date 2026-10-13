import type { Terminal } from '@xterm/xterm';
import type { TypeaheadView } from './typeahead-model';

/** The colours one paint uses, as CSS colours. */
export interface TypeaheadPaintColors {
  background: string;
  foreground: string;
  cursorBackground: string;
  cursorText: string;
}

interface Painter {
  paint(view: TypeaheadView, colors: TypeaheadPaintColors, box: DOMRect): void;
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
 * that draws the way it does, chosen again on `repaint` (the renderer
 * switching, a face finishing its load).
 */
export function createTypeaheadPainter(
  term: Terminal,
  screen: HTMLElement | null | undefined,
): {
  paint(view: TypeaheadView | null, colors: TypeaheadPaintColors): void;
  repaint(): void;
  dispose(): void;
} {
  const choose = (): Painter | null => {
    if (!screen) return null;
    return screen.querySelector('.xterm-rows')
      ? domPainter(term, screen)
      : canvasPainter(term, screen);
  };
  let painter = choose();
  let drawn = false;

  return {
    paint(view, colors) {
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
      painter.paint(view, colors, box);
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
          `background:${cell.cursor ? colors.cursorBackground : colors.background}`,
          `color:${cell.cursor ? colors.cursorText : colors.foreground}`,
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
        context.fillStyle = cell.cursor ? colors.cursorBackground : colors.background;
        context.fillRect(left, top, right - left, cellHeight);
        context.fillStyle = cell.cursor ? colors.cursorText : colors.foreground;
        context.fillText(cell.char, cell.col * cellWidth, top + charTop + deviceChar);
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
