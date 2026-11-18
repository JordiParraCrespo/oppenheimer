import type { ChatFileEdit } from '@oppenheimer/frontend-consumer';

const linesOf = (text: string): string[] => (text ? text.replace(/\n$/, '').split('\n') : []);

/**
 * A turn's edits to one file as the unified diff the diff view reads: one
 * hunk per edit, in the order they were made. The transcript says what each
 * edit replaced and not where in the file, so the hunks are numbered one
 * after the other from line 1: right for a file the turn wrote, and only an
 * order for edits inside a longer one.
 */
export function patchOfEdits(path: string, edits: readonly ChatFileEdit[]): string {
  const name = path.replace(/^\/+/, '');
  const hunks: string[] = [];
  let before = 1;
  let after = 1;
  for (const edit of edits) {
    const removed = linesOf(edit.before);
    const added = linesOf(edit.after);
    if (removed.length === 0 && added.length === 0) continue;
    // A side with no lines is addressed by the line before it, as git does.
    const from = removed.length ? before : before - 1;
    const to = added.length ? after : after - 1;
    hunks.push(
      `@@ -${from},${removed.length} +${to},${added.length} @@`,
      ...removed.map((line) => `-${line}`),
      ...added.map((line) => `+${line}`),
    );
    before += removed.length;
    after += added.length;
  }
  if (hunks.length === 0) return '';
  return [`diff --git a/${name} b/${name}`, `--- a/${name}`, `+++ b/${name}`, ...hunks, ''].join(
    '\n',
  );
}
