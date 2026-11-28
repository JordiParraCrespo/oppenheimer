import { githubEventByInsider } from '../domain/github-event-actor.policy';

/**
 * Which GitHub events count as caused from inside their repository, the gate
 * both a routine's run and a follower's wake pass. The whole table: a
 * regression here lets a stranger on a public repository start an agent on
 * the owner's host with text they wrote (security review E), or refuses the
 * owner's own work.
 */

describe('githubEventByInsider', () => {
  it.each(['issue_opened', 'comment', 'mention', 'review', 'pr_opened', 'pr_draft', 'pr_sync'])(
    "lets an insider's %s through and refuses a stranger's, or one GitHub said nothing of",
    (type) => {
      for (const association of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
        expect(githubEventByInsider(type, { authorAssociation: association })).toBe(true);
      }
      for (const association of ['CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER', 'NONE']) {
        expect(githubEventByInsider(type, { authorAssociation: association })).toBe(false);
      }
      expect(githubEventByInsider(type, {})).toBe(false);
      expect(githubEventByInsider(type, { authorAssociation: null })).toBe(false);
      expect(githubEventByInsider(type, undefined)).toBe(false);
    },
  );

  it('lets through what only a writer can do, whoever wrote the text', () => {
    for (const type of ['push', 'pr_merged', 'release']) {
      expect(githubEventByInsider(type, {})).toBe(true);
      expect(githubEventByInsider(type, { authorAssociation: 'NONE' })).toBe(true);
    }
  });

  it("lets a label through when another person added it, and refuses an issue form's label on a stranger's issue", () => {
    expect(
      githubEventByInsider('issue_labeled', { labeledBy: 'person', authorAssociation: 'NONE' }),
    ).toBe(true);
    // An issue form applies its labels as the issue's author.
    expect(
      githubEventByInsider('issue_labeled', { labeledBy: 'author', authorAssociation: 'NONE' }),
    ).toBe(false);
    // An app (an auto-labeler on a fork's pull request) does not vouch for the text.
    expect(
      githubEventByInsider('issue_labeled', { labeledBy: 'app', authorAssociation: 'CONTRIBUTOR' }),
    ).toBe(false);
    expect(
      githubEventByInsider('issue_labeled', { labeledBy: 'app', authorAssociation: 'MEMBER' }),
    ).toBe(true);
    expect(githubEventByInsider('issue_labeled', {})).toBe(false);
  });

  it("lets a check through on the repository's branch and refuses one on a fork's commit, which has none", () => {
    for (const type of ['check_failed', 'check_passed']) {
      expect(githubEventByInsider(type, { branch: 'main' })).toBe(true);
      expect(githubEventByInsider(type, { branch: null })).toBe(false);
      expect(githubEventByInsider(type, { branch: '' })).toBe(false);
      expect(githubEventByInsider(type, {})).toBe(false);
    }
  });

  it('refuses an event type it has no rule for', () => {
    expect(githubEventByInsider('workflow_run', { authorAssociation: 'OWNER' })).toBe(false);
  });
});
