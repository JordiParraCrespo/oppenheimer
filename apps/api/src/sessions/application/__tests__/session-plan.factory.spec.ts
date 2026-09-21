import { AppError } from '@oppenheimer/backend-core';
import { describe, expect, it } from 'vitest';
import { SessionCheckoutEntity } from '../../domain/session-checkout.entity';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionPlanFactory } from '../session-plan.factory';

/**
 * Where the agent is launched.
 *
 * The aggregate used to refuse a foreign checkout from a `setCwdCheckout` setter;
 * that setter is gone, because `cwdCheckoutId` is folded from the log and a setter
 * beside the fold was a second truth. The refusal moved here, to the factory that
 * turns `cwdGithubRepoId` — what the request names — into the checkout id the log
 * records, and this is the test that moved with it.
 */
function session() {
  return WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
  });
}

function checkout(sessionId: string, githubRepoId: string, directoryName: string) {
  return SessionCheckoutEntity.create({
    id: `checkout-${githubRepoId}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    props: {
      organizationId: 'org-acme',
      sessionId,
      installationId: 'installation-1',
      githubRepoId,
      repositoryFullName: `acme/${directoryName}`,
      storeDirectoryName: null,
      directoryName,
      mode: 'worktree',
      baseBranch: 'main',
      branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
      worktreeCreatedAt: null,
      pushedAt: null,
      removedAt: null,
    },
  });
}

describe('SessionPlanFactory.cwdCheckoutIdFor', () => {
  const factory = new SessionPlanFactory(
    {} as never /* repository access: not reached by this method */,
    {} as never /* project lookup: likewise */,
  );

  it('refuses to launch the agent in a repository this session does not check out', () => {
    const work = session();
    work.attachCheckout(checkout(work.id, '42', 'xrp-mobile'));

    expect(() => factory.cwdCheckoutIdFor(work, 999)).toThrow(AppError);
  });

  it('names the checkout of the repository the request asked for', () => {
    const work = session();
    work.attachCheckout(checkout(work.id, '42', 'xrp-mobile'));
    work.attachCheckout(checkout(work.id, '43', 'xrp-web'));

    expect(factory.cwdCheckoutIdFor(work, 43)).toBe('checkout-43');
  });

  it('falls back to the first checkout, which is the one the session was started for', () => {
    const work = session();
    work.attachCheckout(checkout(work.id, '42', 'xrp-mobile'));
    work.attachCheckout(checkout(work.id, '43', 'xrp-web'));

    expect(factory.cwdCheckoutIdFor(work, undefined)).toBe('checkout-42');
  });

  it('answers null for a session with no git at all, which is a real session', () => {
    expect(factory.cwdCheckoutIdFor(session(), undefined)).toBeNull();
  });
});
