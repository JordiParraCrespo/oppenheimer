import { isRepositoryInsider } from '../domain/github-event-actor.policy';
import { followedPullEvent } from '../domain/github-pull-event.policy';

/**
 * Which stored GitHub events move a pull request someone follows, a session
 * or a bot: both wake handlers ask this one rule, so a regression here wakes a
 * follower on our own app's push, on an issue, or on a subject that is no
 * repository id.
 */
const checkFailed = {
  source: 'github',
  eventType: 'check_failed',
  subjectRef: '123456',
  actorIsOwnApp: false,
  attributes: { number: 128, branch: 'fix/env' },
};

describe('followedPullEvent', () => {
  it('names the repository id, the number and what happened', () => {
    expect(followedPullEvent(checkFailed)).toEqual({
      githubRepoId: '123456',
      number: 128,
      type: 'check_failed',
    });
  });

  it('wakes nobody for our own app, another source, or an event no follower is woken by', () => {
    expect(followedPullEvent({ ...checkFailed, actorIsOwnApp: true })).toBeNull();
    expect(followedPullEvent({ ...checkFailed, source: 'linear' })).toBeNull();
    expect(followedPullEvent({ ...checkFailed, eventType: 'push' })).toBeNull();
  });

  it("wakes nobody for a stranger's comment or review, or a check on a fork's commit", () => {
    // Regression (security review E): anyone can comment on a public
    // repository, and each comment woke the bot or session that followed it.
    const comment = { ...checkFailed, eventType: 'comment' };
    expect(
      followedPullEvent({ ...comment, attributes: { number: 128, authorAssociation: 'NONE' } }),
    ).toBeNull();
    expect(followedPullEvent({ ...comment, attributes: { number: 128 } })).toBeNull();
    expect(
      followedPullEvent({
        ...checkFailed,
        eventType: 'review',
        attributes: { number: 128, authorAssociation: 'CONTRIBUTOR' },
      }),
    ).toBeNull();
    expect(followedPullEvent({ ...checkFailed, attributes: { number: 128 } })).toBeNull();
    expect(
      followedPullEvent({ ...comment, attributes: { number: 128, authorAssociation: 'MEMBER' } }),
    ).toEqual({ githubRepoId: '123456', number: 128, type: 'comment' });
  });

  it('wakes nobody for an issue, an event with no number, or a subject that is no repository id', () => {
    expect(
      followedPullEvent({ ...checkFailed, attributes: { number: 128, isPullRequest: false } }),
    ).toBeNull();
    expect(followedPullEvent({ ...checkFailed, attributes: {} })).toBeNull();
    expect(followedPullEvent({ ...checkFailed, subjectRef: 'acme/app' })).toBeNull();
    expect(followedPullEvent({ ...checkFailed, subjectRef: '0' })).toBeNull();
  });
});

describe('isRepositoryInsider', () => {
  it("counts the repository's owner, members and collaborators in, everyone else out, and says nothing it was not told", () => {
    expect(isRepositoryInsider('OWNER')).toBe(true);
    expect(isRepositoryInsider('collaborator')).toBe(true);
    expect(isRepositoryInsider('CONTRIBUTOR')).toBe(false);
    expect(isRepositoryInsider('NONE')).toBe(false);
    expect(isRepositoryInsider(undefined)).toBeNull();
  });
});
