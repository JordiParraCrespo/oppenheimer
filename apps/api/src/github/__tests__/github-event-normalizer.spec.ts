import { describe, expect, it } from 'vitest';
import { mentions, normalizeGithubDelivery } from '../infrastructure/github-event-normalizer.util';

/**
 * Contract tests: GitHub's payloads, trimmed to the fields that matter, against
 * the catalog event each one must become. A payload GitHub changes breaks a
 * test here rather than an automation in production.
 */

const receivedAt = new Date('2026-09-27T10:00:00Z');
const options = { appSlug: 'oppenheimer-sessions', mentionHandle: 'oppenheimer' };
const repository = { id: 821374923, full_name: 'acme/xrp-mobile', fork: false };
const sender = { login: 'jordiparra', type: 'User' };

function normalize(eventName: string, payload: Record<string, unknown>) {
  return normalizeGithubDelivery(
    {
      deliveryId: 'delivery-1',
      eventName,
      payload: { repository, sender, ...payload },
      receivedAt,
    },
    options,
  );
}

function pullRequest(overrides: Record<string, unknown> = {}) {
  return {
    number: 124,
    title: 'Harden API config loading',
    body: 'Fixes the env loader',
    html_url: 'https://github.com/acme/xrp-mobile/pull/124',
    draft: false,
    merged: false,
    user: { login: 'jordiparra' },
    created_at: '2026-09-27T09:58:00Z',
    updated_at: '2026-09-27T09:59:00Z',
    base: { ref: 'main', repo: { full_name: 'acme/xrp-mobile' } },
    head: {
      ref: 'fix/env',
      sha: 'abc1234def',
      repo: { full_name: 'acme/xrp-mobile', fork: false },
    },
    ...overrides,
  };
}

describe('pull requests', () => {
  it('turns an opened pull request into pr_opened, with its base as the filter attribute', () => {
    const [event, ...rest] = normalize('pull_request', {
      action: 'opened',
      pull_request: pullRequest(),
    });
    expect(rest).toHaveLength(0);
    expect(event).toMatchObject({
      source: 'github',
      type: 'pr_opened',
      externalId: 'delivery-1:pr_opened',
      subject: { kind: 'repository', ref: '821374923', name: 'acme/xrp-mobile' },
      actor: { login: 'jordiparra', isOwnApp: false },
      attributes: { baseBranch: 'main', branch: 'fix/env', number: 124, fork: false },
      context: { ref: '#124', title: 'Harden API config loading' },
    });
    expect(event.occurredAt.toISOString()).toBe('2026-09-27T09:58:00.000Z');
  });

  it('tells a draft from a ready pull request, and a ready-for-review from a new one', () => {
    expect(
      normalize('pull_request', { action: 'opened', pull_request: pullRequest({ draft: true }) })[0]
        .type,
    ).toBe('pr_draft');
    expect(
      normalize('pull_request', { action: 'ready_for_review', pull_request: pullRequest() })[0]
        .type,
    ).toBe('pr_opened');
    expect(
      normalize('pull_request', { action: 'converted_to_draft', pull_request: pullRequest() })[0]
        .type,
    ).toBe('pr_draft');
  });

  it('is pr_sync on new commits and pr_merged only when a close merged it', () => {
    expect(
      normalize('pull_request', { action: 'synchronize', pull_request: pullRequest() })[0].type,
    ).toBe('pr_sync');
    expect(normalize('pull_request', { action: 'closed', pull_request: pullRequest() })).toEqual(
      [],
    );
    expect(
      normalize('pull_request', {
        action: 'closed',
        pull_request: pullRequest({ merged: true, merged_at: '2026-09-27T09:59:30Z' }),
      })[0].type,
    ).toBe('pr_merged');
  });

  it('marks a pull request from a fork', () => {
    const [event] = normalize('pull_request', {
      action: 'opened',
      pull_request: pullRequest({
        head: {
          ref: 'patch-1',
          sha: 'f00',
          repo: { full_name: 'stranger/xrp-mobile', fork: true },
        },
      }),
    });
    expect(event.attributes.fork).toBe(true);
  });

  it("names the head's repository, so a pull request inside a forked repository is told from a fork's", () => {
    const [own] = normalize('pull_request', {
      action: 'opened',
      pull_request: pullRequest({
        head: {
          ref: 'opp/fix-env',
          sha: 'f00',
          repo: { id: 821374923, full_name: 'acme/xrp-mobile', fork: true },
        },
      }),
    });
    expect(own.attributes).toMatchObject({ fork: true, headRepoId: 821374923 });
    expect(own.subject.ref).toBe('821374923');
  });

  it('makes one issue_labeled per label, keyed by the label', () => {
    const [event] = normalize('pull_request', {
      action: 'labeled',
      label: { name: 'bug' },
      pull_request: pullRequest(),
    });
    expect(event).toMatchObject({
      type: 'issue_labeled',
      externalId: 'delivery-1:issue_labeled:bug',
      attributes: { label: 'bug' },
    });
  });
});

describe('issues and comments', () => {
  const issue = {
    number: 203,
    title: 'Invoice parser drops the VAT line',
    body: 'Steps: …',
    html_url: 'https://github.com/acme/xrp-mobile/issues/203',
    user: { login: 'ana' },
    created_at: '2026-09-27T09:00:00Z',
  };

  it('is issue_opened for new issues and nothing for reopened ones', () => {
    expect(normalize('issues', { action: 'opened', issue })[0].type).toBe('issue_opened');
    expect(normalize('issues', { action: 'reopened', issue })).toEqual([]);
  });

  it('is a comment, and also a mention when the body names @oppenheimer', () => {
    const plain = normalize('issue_comment', {
      action: 'created',
      issue,
      comment: { id: 9, body: 'Looks good', created_at: '2026-09-27T09:30:00Z' },
    });
    expect(plain.map((event) => event.type)).toEqual(['comment']);

    const mentioned = normalize('issue_comment', {
      action: 'created',
      issue,
      comment: {
        id: 10,
        body: '@oppenheimer please fix the parser',
        created_at: '2026-09-27T09:31:00Z',
      },
    });
    expect(mentioned.map((event) => event.type)).toEqual(['comment', 'mention']);
    expect(new Set(mentioned.map((event) => event.externalId)).size).toBe(2);
  });

  // Breaks if a bot asked on a pull request is told it is an issue, and reads
  // it with the issue tools, which refuse a pull request's number.
  it('says whether what was commented or labelled is a pull request', () => {
    const on = (event: ReturnType<typeof normalize>[number] | undefined) =>
      event?.attributes.isPullRequest;
    const comment = { id: 11, body: 'hi', created_at: '2026-09-27T09:32:00Z' };
    expect(on(normalize('issue_comment', { action: 'created', issue, comment })[0])).toBe(false);
    expect(
      on(
        normalize('issue_comment', {
          action: 'created',
          issue: { ...issue, pull_request: { url: 'x' } },
          comment,
        })[0],
      ),
    ).toBe(true);
    expect(
      on(
        normalize('pull_request', {
          action: 'labeled',
          label: { name: 'bot:x' },
          pull_request: pullRequest(),
        })[0],
      ),
    ).toBe(true);
  });

  it('caps an untrusted body so it cannot flood a prompt', () => {
    const [event] = normalize('issues', {
      action: 'opened',
      issue: { ...issue, body: 'x'.repeat(20_000) },
    });
    expect(String(event.context.body).length).toBeLessThan(9_000);
    expect(String(event.context.body)).toContain('[truncated');
  });
});

describe('pushes, checks and releases', () => {
  it('is a push to a branch, and nothing for a tag or a deleted branch', () => {
    const [event] = normalize('push', {
      ref: 'refs/heads/main',
      after: '0123456789abcdef',
      commits: [{}, {}],
      head_commit: { message: 'Bump deps', timestamp: '2026-09-27T09:40:00Z' },
      pusher: { name: 'jordiparra' },
    });
    expect(event).toMatchObject({
      type: 'push',
      attributes: { branch: 'main', commits: 2 },
      context: { ref: '0123456' },
    });
    expect(normalize('push', { ref: 'refs/tags/v2.3.0', after: 'x' })).toEqual([]);
    expect(normalize('push', { ref: 'refs/heads/old', deleted: true })).toEqual([]);
  });

  it('is check_failed for a failing suite and check_passed for a green one, on its branch', () => {
    const suite = {
      id: 77,
      head_branch: 'fix/env',
      head_sha: 'abc1234def',
      app: { name: 'GitHub Actions' },
      pull_requests: [{ number: 124 }],
      updated_at: '2026-09-27T09:45:00Z',
    };
    const [event] = normalize('check_suite', {
      action: 'completed',
      check_suite: { ...suite, conclusion: 'failure' },
    });
    expect(event).toMatchObject({
      type: 'check_failed',
      attributes: { branch: 'fix/env', number: 124, conclusion: 'failure' },
    });
    const [green, ...more] = normalize('check_suite', {
      action: 'completed',
      check_suite: { ...suite, conclusion: 'success' },
    });
    expect(more).toHaveLength(0);
    expect(green).toMatchObject({
      type: 'check_passed',
      attributes: { branch: 'fix/env', number: 124, conclusion: 'success' },
    });
    // Neither a skipped nor a cancelled suite says anything about the code.
    for (const conclusion of ['skipped', 'cancelled', 'neutral']) {
      expect(
        normalize('check_suite', { action: 'completed', check_suite: { ...suite, conclusion } }),
      ).toEqual([]);
    }
  });

  it('is a release only when published and not a pre-release', () => {
    const release = { tag_name: 'v2.3.0', name: 'v2.3.0', published_at: '2026-09-27T08:00:00Z' };
    expect(normalize('release', { action: 'published', release })[0].type).toBe('release');
    expect(
      normalize('release', { action: 'published', release: { ...release, prerelease: true } }),
    ).toEqual([]);
    expect(normalize('release', { action: 'created', release })).toEqual([]);
  });
});

describe('our own App', () => {
  it('marks what its bot did, which the loop guard skips', () => {
    const [event] = normalizeGithubDelivery(
      {
        deliveryId: 'd',
        eventName: 'push',
        receivedAt,
        payload: {
          repository,
          sender: { login: 'oppenheimer-sessions[bot]', type: 'Bot' },
          ref: 'refs/heads/opp/abc123',
          after: 'fff',
        },
      },
      options,
    );
    expect(event.actor.isOwnApp).toBe(true);
  });

  it('matches a mention only as a whole handle', () => {
    expect(mentions('ping @oppenheimer', 'oppenheimer')).toBe(true);
    expect(mentions('@Oppenheimer, please', 'oppenheimer')).toBe(true);
    expect(mentions('ping @oppenheimer-sessions', 'oppenheimer')).toBe(false);
    expect(mentions('mail me at x@oppenheimer.dev', 'oppenheimer')).toBe(false);
  });
});

describe('reviews', () => {
  const review = (body: string, state = 'changes_requested') => ({
    id: 901,
    state,
    body,
    html_url: 'https://github.com/acme/xrp-mobile/pull/124#pullrequestreview-901',
    user: { login: 'pau-g' },
    submitted_at: '2026-09-27T09:50:00Z',
  });

  // The regression: a review that mentions nobody was dropped, so an agent
  // watching its pull request never heard that changes were requested.
  it('is a review whatever its state, by its reviewer, and a mention too when it names us', () => {
    const [event, ...rest] = normalize('pull_request_review', {
      action: 'submitted',
      pull_request: pullRequest(),
      review: review('Please split this.'),
    });
    expect(rest).toHaveLength(0);
    expect(event).toMatchObject({
      type: 'review',
      externalId: 'delivery-1:review:901',
      attributes: { number: 124, state: 'changes_requested', reviewId: 901 },
      context: { author: 'pau-g' },
    });
    const both = normalize('pull_request_review', {
      action: 'submitted',
      pull_request: pullRequest(),
      review: review('@oppenheimer can you take this?', 'COMMENTED'),
    });
    expect(both.map((one) => one.type)).toEqual(['review', 'mention']);
    expect(both[0]?.attributes).toMatchObject({ state: 'commented' });
    expect(
      normalize('pull_request_review', {
        action: 'dismissed',
        pull_request: pullRequest(),
        review: review('x'),
      }),
    ).toEqual([]);
  });
});

describe('who acted', () => {
  // The normalizer keeps what GitHub says of the author; the actor policy
  // decides what a stranger's event may start. Breaks if the association is
  // read off the wrong object (the pull request's for a review).
  it("keeps the author's association from the object they wrote", () => {
    const issue = { number: 5, user: { login: 'stranger' }, author_association: 'NONE' };
    expect(normalize('issues', { action: 'opened', issue })[0].attributes).toMatchObject({
      authorAssociation: 'NONE',
    });
    const [comment] = normalize('issue_comment', {
      action: 'created',
      issue,
      comment: { id: 1, body: 'hi', author_association: 'MEMBER' },
    });
    expect(comment.attributes.authorAssociation).toBe('MEMBER');
    const pr = pullRequest({ author_association: 'FIRST_TIME_CONTRIBUTOR' });
    expect(
      normalize('pull_request', { action: 'opened', pull_request: pr })[0].attributes
        .authorAssociation,
    ).toBe('FIRST_TIME_CONTRIBUTOR');
    const [review] = normalize('pull_request_review', {
      action: 'submitted',
      pull_request: pr,
      review: { id: 2, state: 'commented', body: 'x', author_association: 'OWNER' },
    });
    expect(review.attributes.authorAssociation).toBe('OWNER');
    expect(
      normalize('issues', { action: 'opened', issue: { number: 6, author_association: 'x y' } })[0]
        .attributes.authorAssociation,
    ).toBeNull();
  });

  it('says who added a label: the author, an app, or another person', () => {
    const issue = { number: 5, user: { login: 'stranger' }, author_association: 'NONE' };
    const labeled = (by: Record<string, unknown>) =>
      normalizeGithubDelivery(
        {
          deliveryId: 'd',
          eventName: 'issues',
          payload: { repository, sender: by, action: 'labeled', label: { name: 'bug' }, issue },
          receivedAt,
        },
        options,
      )[0].attributes.labeledBy;
    expect(labeled({ login: 'stranger', type: 'User' })).toBe('author');
    expect(labeled({ login: 'github-actions[bot]', type: 'Bot' })).toBe('app');
    expect(labeled({ login: 'maintainer', type: 'User' })).toBe('person');
  });
});
