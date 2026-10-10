import type { PullRequestActivityItem } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { activityEntries, commenters } from '../lib/activity';

/**
 * The Activity section folds a run of pushed commits into one row, as the
 * Codex app does, and the rail counts who commented. What breaks if this
 * drifts: every commit of a long branch as its own row, commits pushed after
 * a review merged into the run before it, or a review counted as a comment.
 */
const at = (minute: number) => new Date(Date.UTC(2026, 9, 6, 10, minute));
const commit = (sha: string, minute: number): PullRequestActivityItem => ({
  kind: 'commit',
  id: `commit:${sha}`,
  sha,
  message: sha,
  author: 'lucia',
  at: at(minute),
});
const comment = (author: string, minute: number): PullRequestActivityItem => ({
  kind: 'comment',
  id: `comment:${author}${minute}`,
  author,
  body: 'hi',
  at: at(minute),
});

describe('activityEntries', () => {
  it('folds commits pushed in a row, and starts a new run after anything else', () => {
    const entries = activityEntries([
      commit('a', 1),
      commit('b', 2),
      comment('ana', 3),
      commit('c', 4),
    ]);
    expect(entries.map((entry) => entry.kind)).toEqual(['commits', 'comment', 'commits']);
    const [first, , last] = entries;
    expect(first?.kind === 'commits' && first.commits.map((c) => c.sha)).toEqual(['a', 'b']);
    expect(first?.kind === 'commits' && first.at).toEqual(at(2));
    expect(last?.kind === 'commits' && last.commits.length).toBe(1);
  });
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
