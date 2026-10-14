import type { AccessScope } from '@oppenheimer/backend-authz';
import { describe, expect, it, vi } from 'vitest';
import type { PullRequestAccessPort } from '../../../../github/application/pull-request-access.port';
import type { ReviewSessionRepositoryPort } from '../../../database/review-session.repository.port';
import { StartReviewSessionCommand } from '../start-review-session.command';
import { StartReviewSessionCommandHandler } from '../start-review-session.command-handler';

/**
 * Starting a review session: the session New session would make, on the
 * pull request's head branch with the review prompt and the origin `review`,
 * then the link that files it under the pull request. A fork's head is
 * refused before anything is made. The session's own creation is the sessions
 * module's, covered there.
 */
const SCOPE: AccessScope = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const ADDRESS = { installationId: 'inst-1', githubRepoId: 42, number: 14 };

function setup(fromFork = false) {
  const access = {
    pullRequest: vi.fn().mockResolvedValue({
      repository: { fullName: 'acme/web' },
      pull: {
        number: 14,
        title: 'Fix the empty state',
        headRef: 'fix/empty',
        baseRef: 'main',
        fromFork,
      },
    }),
  } satisfies Pick<PullRequestAccessPort, 'pullRequest'>;
  const reviews = {
    link: vi.fn().mockResolvedValue(undefined),
    findOpen: vi.fn(),
  } satisfies ReviewSessionRepositoryPort;
  const commandBus = { execute: vi.fn().mockResolvedValue({ sessionId: 'session-1', hints: [] }) };
  const handler = new StartReviewSessionCommandHandler(
    access as unknown as PullRequestAccessPort,
    reviews,
    commandBus as never,
  );
  const run = (key: string | null = 'key-1') =>
    handler.execute(
      new StartReviewSessionCommand({
        scope: SCOPE,
        userId: 'user-1',
        address: ADDRESS,
        hostId: 'host-1',
        idempotencyKey: key,
      }),
    );
  return { run, reviews, commandBus };
}

describe('starting a review session', () => {
  it('creates the session on the head branch as a review, then files it under the pull request', async () => {
    const { run, reviews, commandBus } = setup();
    await expect(run()).resolves.toEqual({ sessionId: 'session-1', hints: [] });

    const created = commandBus.execute.mock.calls[0]?.[0];
    expect(created).toMatchObject({
      origin: 'review',
      userId: 'user-1',
      idempotencyKey: 'review:inst-1:42:14:key-1',
      input: {
        hostId: 'host-1',
        agent: 'claude-code',
        checkouts: [{ installationId: 'inst-1', githubRepoId: 42, baseBranch: 'fix/empty' }],
        launch: { permission: 'auto' },
      },
    });
    expect(created.input.prompt).toContain('git diff origin/main...HEAD');
    expect(reviews.link).toHaveBeenCalledWith(SCOPE, {
      sessionId: 'session-1',
      installationId: 'inst-1',
      githubRepoId: 42,
      repository: 'acme/web',
      number: 14,
      title: 'Fix the empty state',
      headRef: 'fix/empty',
      baseRef: 'main',
    });
  });

  it('refuses a pull request from a fork with PULLS_002 and makes nothing', async () => {
    const { run, reviews, commandBus } = setup(true);
    await expect(run()).rejects.toMatchObject({ code: 'PULLS_002' });
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(reviews.link).not.toHaveBeenCalled();
  });
});
