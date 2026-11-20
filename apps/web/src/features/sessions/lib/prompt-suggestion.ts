import { readPromptSuggestion, type ScreenRow } from '@oppenheimer/frontend-consumer';
import type { IBufferCell, Terminal } from '@xterm/xterm';
import { watchScreen } from './screen-watch';

/** xterm's palette index of bright black, the grey of `\e[90m`. */
const BRIGHT_BLACK = 8;

/**
 * Whether a cell is drawn faint: dim, or a grey foreground that is neither
 * the theme's text nor its background. Claude Code draws a suggestion in its
 * theme's `inactive` colour: a mid grey in truecolor (153 on dark, 102 on
 * light), bright black or dim under an ANSI-only theme. What the person types
 * is drawn in the default colour, or white or black.
 */
function isFaint(cell: IBufferCell): boolean {
  if (cell.isDim()) return true;
  if (cell.isFgDefault()) return false;
  const color = cell.getFgColor();
  if (cell.isFgPalette()) return color === BRIGHT_BLACK || (color >= 238 && color <= 250);
  if (!cell.isFgRGB()) return false;
  const [r, g, b] = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const level = (r + g + b) / 3;
  return spread <= 24 && level >= 64 && level <= 200;
}

/**
 * Reads the next message the agent suggests off its input box as output
 * lands, and hands it to `onSuggestion` (`readPromptSuggestion`): none once
 * it is gone. Only the screen's rows are read, cell by cell for their style,
 * since only the style tells a suggestion from words the person typed.
 */
export function bindPromptSuggestion(
  term: Terminal,
  onSuggestion: (suggestion: string | null) => void,
): () => void {
  const stop = watchScreen(term, () => {
    const buffer = term.buffer.active;
    const cell = buffer.getNullCell();
    const rows: ScreenRow[] = [];
    for (let row = 0; row < term.rows; row++) {
      const line = buffer.getLine(buffer.baseY + row);
      let text = '';
      const faint: boolean[] = [];
      for (let x = 0; line && x < line.length; x++) {
        if (!line.getCell(x, cell) || cell.getWidth() === 0) continue;
        const chars = cell.getChars() || ' ';
        text += chars;
        for (let unit = 0; unit < chars.length; unit++) faint.push(isFaint(cell));
      }
      rows.push({ text: text.trimEnd(), faint });
    }
    onSuggestion(readPromptSuggestion(rows));
  });
  return () => {
    stop();
    onSuggestion(null);
  };
}
