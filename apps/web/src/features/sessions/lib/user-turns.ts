import type { IBufferCell, IDecoration, IDisposable, Terminal } from '@xterm/xterm';

/**
 * The reader's own messages, drawn the way the artboard draws them
 * (`op-term__you`): a rounded, full-width tint with a blue chevron, rather
 * than the grey strip the agent paints behind them.
 *
 * Claude Code marks a user message itself: a pointer, then the text, on its
 * `userMessageBackground`. That colour is the one thing in the grid that says
 * "the reader wrote this", so it is what a turn is found by. The strip is
 * Claude's theme, not ours: its dark theme's grey on a light console is a dark
 * bar with white text, so the cells are repainted in the terminal's own ramp
 * and the tint is laid over them.
 */

/**
 * `userMessageBackground` as it reaches the grid. tmux runs without RGB, so
 * Claude's greys arrive as the 256-colour entries nearest them: 237 for the
 * dark theme's rgb(55,55,55), 255 and 253 for the light themes' 240 and 220.
 * The ANSI themes name 8 and 7. The RGB values are for a pane that keeps
 * truecolor. A colour alone is not a turn: the row also has to open on the
 * pointer (`findUserTurns`).
 */
const PALETTE_BACKGROUNDS = new Set([237, 253, 255, 7, 8]);
const RGB_BACKGROUNDS = new Set([0x373737, 0xf0f0f0, 0xdcdcdc]);
const POINTERS = new Set(['❯', '>']);

/** The artboard's bubble (`op-term__you`): padding 8px 10px, radius 10px. */
const BUBBLE_INSET_X = 10;
const BUBBLE_INSET_Y = 8;
const BUBBLE_RADIUS = 10;

/** The rows `findUserTurns` reads, whatever holds them. */
export interface TurnGrid {
  readonly lines: number;
  readonly cols: number;
  char(line: number, x: number): string;
  userBackground(line: number, x: number): boolean;
}

/** A message the reader wrote: its first line, its column and its pointer's. */
export interface UserTurn {
  line: number;
  x: number;
  pointerX: number;
  height: number;
}

/**
 * The user messages on the grid. A turn opens on a row whose first painted
 * cell is the user background with only blanks before it, and whose first
 * glyph on that background is the pointer. It runs on through the rows that
 * keep the background at the same column (a wrapped or multi-line message)
 * and stops at the next pointer, so two messages never merge.
 */
export function findUserTurns(grid: TurnGrid): UserTurn[] {
  const turns: UserTurn[] = [];
  const opening = (line: number): { x: number; pointerX: number } | null => {
    let x = 0;
    while (x < grid.cols && !grid.userBackground(line, x)) {
      if (grid.char(line, x).trim() !== '') return null;
      x += 1;
    }
    let pointerX = x;
    while (
      pointerX < grid.cols &&
      grid.userBackground(line, pointerX) &&
      grid.char(line, pointerX).trim() === ''
    ) {
      pointerX += 1;
    }
    if (pointerX >= grid.cols || !grid.userBackground(line, pointerX)) return null;
    return POINTERS.has(grid.char(line, pointerX)) ? { x, pointerX } : null;
  };

  for (let line = 0; line < grid.lines; line += 1) {
    const open = opening(line);
    if (!open) continue;
    let height = 1;
    while (
      line + height < grid.lines &&
      grid.userBackground(line + height, open.x) &&
      !opening(line + height)
    ) {
      height += 1;
    }
    turns.push({ line, x: open.x, pointerX: open.pointerX, height });
    line += height - 1;
  }
  return turns;
}

function isUserBackground(cell: IBufferCell): boolean {
  if (cell.isBgPalette()) return PALETTE_BACKGROUNDS.has(cell.getBgColor());
  if (cell.isBgRGB()) return RGB_BACKGROUNDS.has(cell.getBgColor());
  return false;
}

/** The colours a turn is repainted in, as `#rrggbb` (all a decoration takes). */
export interface TurnColors {
  background: string;
  foreground: string;
  pointer: string;
}

/** A turn on the grid: its shape, and the decorations that repaint it. */
interface Drawn {
  shape: string;
  decorations: IDecoration[];
}

const shapeOf = (turn: UserTurn, cols: number) =>
  `${turn.x}:${turn.pointerX}:${turn.height}:${cols}`;

/**
 * Finds the reader's messages on `term` and draws them as the artboard does,
 * until disposed. It reads the grid after each render (one pass per frame),
 * so a message the agent redraws, scrolls or clears is followed.
 *
 * Two layers, because xterm hides decoration elements on the alternate
 * screen, which is where a tmux client puts it: cell decorations repaint the
 * turn's cells (xterm applies those on either screen), and the bubble is an
 * element of ours laid over the grid, translucent so the text shows through.
 */
export function bindUserTurns(
  term: Terminal,
  readColors: () => TurnColors,
): IDisposable & { repaint(): void } {
  const screen = term.element?.querySelector<HTMLElement>('.xterm-screen');
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;';
  screen?.appendChild(overlay);

  let colors = readColors();
  let drawn: Drawn[] = [];
  const cell = term.buffer.active.getNullCell();

  // The alternate screen is the whole grid; on the normal one, the rows in
  // view plus enough above them to find where a message in view begins.
  const readGrid = (): { grid: TurnGrid; first: number } => {
    const buffer = term.buffer.active;
    const alternate = buffer.type === 'alternate';
    const first = alternate ? 0 : Math.max(0, buffer.viewportY - 50);
    const last = alternate ? buffer.length : buffer.viewportY + term.rows;
    const at = (line: number, x: number) => buffer.getLine(first + line)?.getCell(x, cell);
    return {
      first,
      grid: {
        lines: last - first,
        cols: term.cols,
        char: (line, x) => at(line, x)?.getChars() ?? '',
        userBackground: (line, x) => {
          const found = at(line, x);
          return found ? isUserBackground(found) : false;
        },
      },
    };
  };

  const clear = (turn: Drawn) => {
    for (const decoration of turn.decorations) {
      decoration.marker.dispose();
      decoration.dispose();
    }
  };

  const decorate = (line: number, turn: UserTurn): IDecoration[] => {
    const buffer = term.buffer.active;
    const decorations: IDecoration[] = [];
    for (let row = 0; row < turn.height; row += 1) {
      const marker = term.registerMarker(line + row - (buffer.baseY + buffer.cursorY));
      const repaint = term.registerDecoration({
        marker,
        x: turn.x,
        width: term.cols - turn.x,
        backgroundColor: colors.background,
        foregroundColor: colors.foreground,
      });
      if (repaint) decorations.push(repaint);
      if (row === 0) {
        // Registered after the row's, so its foreground is the one that wins.
        const pointer = term.registerDecoration({
          marker,
          x: turn.pointerX,
          width: 1,
          foregroundColor: colors.pointer,
        });
        if (pointer) decorations.push(pointer);
      }
    }
    return decorations;
  };

  const drawBubbles = (turns: { row: number; turn: UserTurn }[]) => {
    const cellWidth = (screen?.clientWidth ?? 0) / term.cols;
    // The artboard's bubble spans the pane's text column, not the grid: the
    // grid stops at its last whole cell, up to a column short of the pane.
    const width = term.element?.clientWidth ?? 0;
    const cellHeight = (screen?.clientHeight ?? 0) / term.rows;
    while (overlay.childElementCount > turns.length) overlay.lastElementChild?.remove();
    while (overlay.childElementCount < turns.length) {
      const bubble = document.createElement('div');
      bubble.style.cssText = `position:absolute;border-radius:${BUBBLE_RADIUS}px;background:var(--hover-surface);`;
      overlay.appendChild(bubble);
    }
    turns.forEach(({ row, turn }, index) => {
      const bubble = overlay.children[index] as HTMLElement;
      const left = turn.x * cellWidth - BUBBLE_INSET_X;
      bubble.style.left = `${left}px`;
      bubble.style.width = `${width + BUBBLE_INSET_X - left}px`;
      bubble.style.top = `${row * cellHeight - BUBBLE_INSET_Y}px`;
      bubble.style.height = `${turn.height * cellHeight + 2 * BUBBLE_INSET_Y}px`;
    });
  };

  const scan = () => {
    const buffer = term.buffer.active;
    const { grid, first } = readGrid();
    const found = findUserTurns(grid).map((turn) => ({
      line: first + turn.line,
      turn,
      shape: shapeOf(turn, term.cols),
    }));
    const wanted = new Set(found.map((f) => `${f.line}@${f.shape}`));
    // A marker follows its line as the grid scrolls, so a drawn turn is kept
    // while its line still opens a turn of the same shape; anything else is a
    // message the agent redrew away.
    const kept = drawn.filter((turn) => {
      const line = turn.decorations[0]?.marker.line ?? -1;
      if (line >= 0 && wanted.has(`${line}@${turn.shape}`)) return true;
      clear(turn);
      return false;
    });
    const have = new Set(kept.map((turn) => `${turn.decorations[0]?.marker.line}@${turn.shape}`));
    for (const f of found) {
      if (!have.has(`${f.line}@${f.shape}`)) {
        kept.push({ shape: f.shape, decorations: decorate(f.line, f.turn) });
      }
    }
    drawn = kept;
    drawBubbles(
      found
        .map((f) => ({ row: f.line - buffer.viewportY, turn: f.turn }))
        .filter(({ row, turn }) => row + turn.height > 0 && row < term.rows),
    );
  };

  let frame: number | null = null;
  const schedule = () => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      scan();
    });
  };
  const onRender = term.onRender(schedule);
  const onBuffer = term.buffer.onBufferChange(() => {
    for (const turn of drawn) clear(turn);
    drawn = [];
    schedule();
  });
  schedule();

  return {
    /** The theme changed: every turn is repainted in the new ramp. */
    repaint() {
      colors = readColors();
      for (const turn of drawn) clear(turn);
      drawn = [];
      schedule();
    },
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      onRender.dispose();
      onBuffer.dispose();
      for (const turn of drawn) clear(turn);
      overlay.remove();
    },
  };
}
