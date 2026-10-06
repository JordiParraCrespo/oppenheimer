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

const toDiffSide = (side: 'LEFT' | 'RIGHT') => (side === 'LEFT' ? 'deletions' : 'additions');
export const toGithubSide = (side: 'additions' | 'deletions'): 'LEFT' | 'RIGHT' =>
  side === 'deletions' ? 'LEFT' : 'RIGHT';

/** One file's notes, in the shape the diff view draws: GitHub's, the review's pending ones, the open draft. */
export function notesOf(
  path: string,
  posted: readonly PullRequestComment[],
  pending: readonly LineCommentInput[],
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
  pending.forEach((comment, index) => {
    if (comment.path !== path) return;
    notes.push({
      side: toDiffSide(comment.side),
      lineNumber: comment.line,
      metadata: { kind: 'pending', index, body: comment.body },
    });
  });
  if (draft && draft.path === path) {
    notes.push({
      side: toDiffSide(draft.side),
      lineNumber: draft.line,
      metadata: { kind: 'draft' },
    });
  }
  return notes;
}
