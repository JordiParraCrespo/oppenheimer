import type { DiffAnnotation } from '@oppenheimer/design-system-web';
import type { LineCommentInput, PullRequestComment } from '@oppenheimer/frontend-consumer';

/** What a line on the diff carries: a comment GitHub has, one pending in the review, or the one being written. */
export type DiffNote =
  | { kind: 'posted'; id: number; author: string; body: string }
  | { kind: 'pending'; index: number; body: string }
  | { kind: 'draft' };

export interface DraftLine {
  path: string;
  side: 'LEFT' | 'RIGHT';
  line: number;
}

/** A comment pending in the review, with its place in it, which is what discarding it names. */
export interface PendingNote {
  index: number;
  comment: LineCommentInput;
}

/** The review's pending comments by file, so each file is handed only its own. */
export function pendingByPath(pending: readonly LineCommentInput[]): Map<string, PendingNote[]> {
  const byPath = new Map<string, PendingNote[]>();
  pending.forEach((comment, index) => {
    const notes = byPath.get(comment.path);
    if (notes) notes.push({ index, comment });
    else byPath.set(comment.path, [{ index, comment }]);
  });
  return byPath;
}

const toDiffSide = (side: 'LEFT' | 'RIGHT') => (side === 'LEFT' ? 'deletions' : 'additions');
export const toGithubSide = (side: 'additions' | 'deletions'): 'LEFT' | 'RIGHT' =>
  side === 'deletions' ? 'LEFT' : 'RIGHT';

/** One file's notes, in the shape the diff view draws: GitHub's, the review's pending ones on it, the open draft. */
export function notesOf(
  path: string,
  posted: readonly PullRequestComment[],
  pending: readonly PendingNote[],
  draft: DraftLine | null,
): DiffAnnotation<DiffNote>[] {
  const notes: DiffAnnotation<DiffNote>[] = [];
  for (const comment of posted) {
    if (comment.path !== path || comment.line === null) continue;
    notes.push({
      side: toDiffSide(comment.side),
      lineNumber: comment.line,
      metadata: { kind: 'posted', id: comment.id, author: comment.author, body: comment.body },
    });
  }
  for (const { index, comment } of pending) {
    notes.push({
      side: toDiffSide(comment.side),
      lineNumber: comment.line,
      metadata: { kind: 'pending', index, body: comment.body },
    });
  }
  if (draft && draft.path === path) {
    notes.push({
      side: toDiffSide(draft.side),
      lineNumber: draft.line,
      metadata: { kind: 'draft' },
    });
  }
  return notes;
}
