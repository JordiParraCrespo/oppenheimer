import { describe, expect, it } from 'vitest';
import { timelineItemOf } from '../infrastructure/github-pulls.adapter';

/**
 * A pull request's conversation is read from GitHub's issue timeline, whose
 * entries differ by `event`. What breaks if this mapping drifts: a comment
 * shown without its author or body, a commit credited to `ghost`, a pending
 * review (only its author can see it) shown to everyone, or a label event
 * the console has no words for reaching the screen.
 */
describe('timelineItemOf', () => {
  it('reads a comment, a commit and a review by their own fields', () => {
    expect(
      timelineItemOf(
        { event: 'commented', id: 7, user: { login: 'ana' }, body: 'LGTM', created_at: 't1' },
        0,
      ),
    ).toEqual({
      kind: 'comment',
      id: 'comment:7',
      login: 'ana',
      insider: null,
      body: 'LGTM',
      at: 't1',
    });
    expect(
      timelineItemOf(
        {
          event: 'committed',
          sha: 'abc',
          message: 'Fix it',
          author: { name: 'Lucía', date: 't2' },
        },
        1,
      ),
    ).toEqual({
      kind: 'commit',
      id: 'commit:abc',
      sha: 'abc',
      login: 'Lucía',
      message: 'Fix it',
      at: 't2',
    });
    expect(
      timelineItemOf(
        {
          event: 'reviewed',
          id: 9,
          user: { login: 'bo' },
          state: 'APPROVED',
          body: null,
          submitted_at: 't3',
        },
        2,
      ),
    ).toEqual({
      kind: 'review',
      id: 'review:9',
      login: 'bo',
      insider: null,
      state: 'approved',
      body: '',
      at: 't3',
    });
  });

  // What breaks this: a comment from a stranger read as a collaborator's, so
  // the bot is not told whose words could be a prompt injection.
  it("says whether a comment's or a review's author is part of the repository", () => {
    const by = (association: string) =>
      timelineItemOf(
        {
          event: 'commented',
          id: 1,
          user: { login: 'x' },
          body: '',
          created_at: 't',
          author_association: association,
        },
        0,
      );
    expect(by('OWNER')).toMatchObject({ insider: true });
    expect(by('MEMBER')).toMatchObject({ insider: true });
    expect(by('COLLABORATOR')).toMatchObject({ insider: true });
    expect(by('CONTRIBUTOR')).toMatchObject({ insider: false });
    expect(by('FIRST_TIME_CONTRIBUTOR')).toMatchObject({ insider: false });
    expect(by('NONE')).toMatchObject({ insider: false });
    expect(
      timelineItemOf(
        {
          event: 'reviewed',
          id: 2,
          user: { login: 'y' },
          state: 'COMMENTED',
          author_association: 'NONE',
        },
        0,
      ),
    ).toMatchObject({ kind: 'review', insider: false });
  });

  it('names who a review was asked of, and who merged', () => {
    expect(
      timelineItemOf(
        {
          event: 'review_requested',
          actor: { login: 'ana' },
          requested_reviewer: { login: 'bo' },
          created_at: 't',
        },
        3,
      ),
    ).toMatchObject({ kind: 'event', event: 'review_requested', login: 'ana', subject: 'bo' });
    expect(
      timelineItemOf({ event: 'merged', id: 4, actor: { login: 'ana' }, created_at: 't' }, 4),
    ).toMatchObject({ kind: 'event', id: 'merged:4', event: 'merged', subject: null });
  });

  it('leaves out what the console does not show', () => {
    expect(timelineItemOf({ event: 'labeled', actor: { login: 'ana' } }, 0)).toBeNull();
    expect(
      timelineItemOf({ event: 'reviewed', state: 'PENDING', user: { login: 'ana' } }, 0),
    ).toBeNull();
    expect(timelineItemOf({ event: 'committed' }, 0)).toBeNull();
  });
});
