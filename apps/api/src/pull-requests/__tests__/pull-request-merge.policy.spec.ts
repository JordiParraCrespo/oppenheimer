import { describe, expect, it } from 'vitest';
import {
  latestVerdicts,
  type MergeFacts,
  mergeBlocker,
  mergeGates,
  scopeOf,
  visibleInQueue,
} from '../domain/pull-request-merge.policy';

const READY: MergeFacts = {
  draft: false,
  merged: false,
  state: 'open',
  mergeable: true,
  mergeableState: 'clean',
  checks: 'passing',
  verdicts: ['APPROVED'],
};

describe('what holds a pull request', () => {
  it('names nothing when it can merge, or when it is already merged or closed', () => {
    expect(mergeBlocker(READY)).toBeNull();
    expect(mergeBlocker({ ...READY, merged: true, draft: true })).toBeNull();
    expect(mergeBlocker({ ...READY, state: 'closed', mergeable: false })).toBeNull();
  });

  it('names the first thing to do: draft, then conflicts, then checks, then review', () => {
    const everything: MergeFacts = {
      ...READY,
      draft: true,
      mergeable: false,
      checks: 'failing',
      verdicts: ['CHANGES_REQUESTED'],
    };
    expect(mergeBlocker(everything)).toBe('draft');
    expect(mergeBlocker({ ...everything, draft: false })).toBe('conflicts');
    expect(mergeBlocker({ ...everything, draft: false, mergeable: true })).toBe('checks_failing');
    expect(mergeBlocker({ ...everything, draft: false, mergeable: true, checks: 'running' })).toBe(
      'checks_running',
    );
    expect(mergeBlocker({ ...everything, draft: false, mergeable: true, checks: 'passing' })).toBe(
      'changes_requested',
    );
  });

  it('reads GitHub’s mergeable_state for what the rules above do not cover', () => {
    expect(mergeBlocker({ ...READY, mergeableState: 'behind' })).toBe('behind');
    expect(mergeBlocker({ ...READY, mergeableState: 'blocked', verdicts: [] })).toBe(
      'approval_required',
    );
    expect(mergeBlocker({ ...READY, mergeableState: 'dirty', mergeable: null })).toBe('conflicts');
  });
});

describe('the path to merge', () => {
  it('marks each gate met, failed or still to come', () => {
    expect(mergeGates(READY)).toEqual({
      checks: 'done',
      conflicts: 'done',
      review: 'done',
      merge: 'pending',
    });
    expect(mergeGates({ ...READY, checks: 'running', mergeable: null, verdicts: [] })).toEqual({
      checks: 'pending',
      conflicts: 'pending',
      review: 'pending',
      merge: 'pending',
    });
    expect(
      mergeGates({
        ...READY,
        checks: 'failing',
        mergeable: false,
        verdicts: ['APPROVED', 'CHANGES_REQUESTED'],
      }),
    ).toEqual({ checks: 'failed', conflicts: 'failed', review: 'failed', merge: 'pending' });
  });
});

describe('each reviewer’s latest verdict', () => {
  it('keeps the last approval or change request, never lets a later comment undo it, and skips the author', () => {
    const reviews = [
      { login: 'ana', state: 'CHANGES_REQUESTED' },
      { login: 'ana', state: 'APPROVED' },
      { login: 'ana', state: 'COMMENTED' },
      { login: 'bo', state: 'COMMENTED' },
      { login: 'cy', state: 'DISMISSED' },
      { login: 'author', state: 'APPROVED' },
    ];
    expect(latestVerdicts(reviews, 'author')).toEqual(['APPROVED', 'COMMENTED']);
  });
});

describe('whose queue a pull request is in', () => {
  const pull = { authorLogin: 'bo', headRef: 'feature', requestedReviewers: ['ana'] };

  it('is yours when you or one of your sessions opened it', () => {
    expect(scopeOf({ ...pull, authorLogin: 'ana' }, 'ana')).toBe('mine');
    expect(scopeOf({ ...pull, headRef: 'oppenheimer/keychain' }, null)).toBe('mine');
  });

  it('is a review request when your login was asked, and otherwise what you watch', () => {
    expect(scopeOf(pull, 'ana')).toBe('requested');
    expect(scopeOf(pull, 'cy')).toBe('watching');
    expect(scopeOf(pull, null)).toBe('watching');
  });
});

describe('which pull requests the queue shows', () => {
  it('shows yours and the reviews asked of you from every repository', () => {
    expect(visibleInQueue('mine', false)).toBe(true);
    expect(visibleInQueue('requested', false)).toBe(true);
  });

  it('shows the rest only from a repository you watch', () => {
    expect(visibleInQueue('watching', false)).toBe(false);
    expect(visibleInQueue('watching', true)).toBe(true);
  });
});
