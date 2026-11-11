/** Lines a sent message shows before it folds. */
const FOLD_LINES = 12;
/** Characters it shows before it folds, for a long text on few lines. */
const FOLD_CHARS = 1500;

/**
 * Where a long message you sent folds in the chat, so a pasted log of a
 * thousand lines is a card of twelve with Show all under it: its first lines
 * (or first characters, for one long line) and how many lines it has in
 * all. Null for a message short enough to show whole.
 */
export function foldOf(text: string): { head: string; lines: number } | null {
  const lines = text.split('\n');
  if (lines.length <= FOLD_LINES && text.length <= FOLD_CHARS) return null;
  const head = lines.slice(0, FOLD_LINES).join('\n');
  return {
    head: head.length > FOLD_CHARS ? `${head.slice(0, FOLD_CHARS)}…` : head,
    lines: lines.length,
  };
}
