/**
 * A tool's output as the chat's compact view draws it, the way Codex's
 * transcript caps a call: its first `maxLines` lines, a line too long to
 * read in one go cut to its head and tail around an ellipsis, and how much
 * was left out, so the control under it can say "+N lines". Nothing is
 * thrown away: the caller still holds the whole text, and the expanded view
 * draws it as it came.
 */
export interface ClippedOutput {
  lines: string[];
  /** Lines past `maxLines`, not drawn. */
  hidden: number;
  /** Some drawn line was cut to its head and tail. */
  cut: boolean;
}

/** Where a long line is cut: past this many characters, it keeps its head and tail. */
export const LINE_MAX = 240;

/** A line past `max` characters as its head, an ellipsis and its tail; any other as it is. */
export function clipLine(line: string, max = LINE_MAX): string {
  if (line.length <= max) return line;
  const tail = Math.floor(max / 3);
  const head = max - tail;
  return `${line.slice(0, head)} … ${line.slice(line.length - tail)}`;
}

/** The output's lines, its trailing newline dropped. */
export function linesOf(text: string): string[] {
  return text.replace(/\n$/, '').split('\n');
}

/** The first `maxLines` lines of `text`, each clipped, and what was left out. */
export function clipOutput(text: string, maxLines: number, lineMax = LINE_MAX): ClippedOutput {
  const all = linesOf(text);
  const shown = all.slice(0, Math.max(0, maxLines));
  const lines = shown.map((line) => clipLine(line, lineMax));
  return {
    lines,
    hidden: all.length - shown.length,
    cut: lines.some((line, index) => line !== shown[index]),
  };
}
