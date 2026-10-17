import type { PullRequestActivityItem } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { commenters } from '../lib/activity';

/**
 * The rail counts who commented on the conversation. What breaks if this
 * drifts: a review counted as a comment, or the commenters out of order.
 */
const at = (minute: number) => new Date(Date.UTC(2026, 9, 6, 10, minute));
const comment = (author: string, minute: number): PullRequestActivityItem => ({
  kind: 'comment',
  id: `comment:${author}${minute}`,
  author,
  body: 'hi',
  at: at(minute),
});

describe('commenters', () => {
  it('counts each person’s comments, first commenter first, and nothing else', () => {
    const review: PullRequestActivityItem = {
      kind: 'review',
      id: 'review:1',
      author: 'bo',
      state: 'approved',
      body: '',
      at: at(5),
    };
    expect(commenters([comment('ana', 1), review, comment('bo', 2), comment('ana', 3)])).toEqual([
      { login: 'ana', count: 2 },
      { login: 'bo', count: 1 },
    ]);
  });
});
