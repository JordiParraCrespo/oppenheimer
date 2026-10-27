import { MAX_SESSION_CHECKOUTS } from '@oppenheimer/shared';
import { Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectLookupPort } from '../../../../projects/application/project-lookup.port';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import type { SessionLaunchSpecFactory } from '../../../application/session-launch.factory';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type { SessionPlanFactory } from '../../../application/session-plan.factory';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SessionCheckoutEntity } from '../../../domain/session-checkout.entity';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { AddCheckoutCommand } from '../add-checkout.command';
import { AddCheckoutCommandHandler } from '../add-checkout.command-handler';

/**
 * A session checks out up to `MAX_SESSION_CHECKOUTS` repositories, one worktree
 * each: another is added below the bound, and refused at it here, before a row is
 * written, rather than by the host after it was.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function checkoutOf(work: WorkSessionEntity, index: number) {
  return SessionCheckoutEntity.createNew({
    organizationId: 'org-acme',
    sessionId: work.id,
    installationId: 'installation-1',
    githubRepoId: String(42 + index),
    repositoryFullName: `acme/repo-${index}`,
    directoryName: `repo-${index}`,
    baseBranch: 'main',
    branch: 'oppenheimer/swift-wren-7gyezw',
  });
}

function sessionWithRepositories(count: number) {
  const work = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'swift-wren-7gyezw',
    agent: 'claude-code',
  });
  for (let index = 0; index < count; index++) work.attachCheckout(checkoutOf(work, index));
  return work;
}

function harness(work: WorkSessionEntity) {
  const sessions = {
    findOneById: vi.fn().mockResolvedValue(Some(work)),
    insertCheckout: vi.fn().mockResolvedValue(undefined),
  } as unknown as WorkSessionRepositoryPort;
  const added = checkoutOf(work, 99);
  const plan = {
    attachCheckout: vi.fn().mockResolvedValue(added),
  } as unknown as SessionPlanFactory;
  const dispatch = {
    addCheckout: vi.fn().mockResolvedValue({ delivered: true, hints: [] }),
  } as unknown as SessionDispatchPort;
  const projects = {
    findOneById: vi.fn().mockResolvedValue(Some({ isArchived: false, slug: 'xrp' })),
  } as unknown as ProjectLookupPort;
  const handler = new AddCheckoutCommandHandler(
    new SessionLoaderResolver(sessions),
    sessions,
    projects,
    dispatch,
    plan,
    { build: vi.fn().mockResolvedValue({}) } as unknown as SessionLaunchSpecFactory,
  );
  const add = () =>
    handler.execute(
      new AddCheckoutCommand({
        scope: SCOPE,
        sessionId: work.id,
        input: { installationId: 'installation-1', githubRepoId: 7 },
      }),
    );
  return { sessions, plan, dispatch, add, added };
}

describe('AddCheckoutCommandHandler', () => {
  it('adds a second repository to a session that has one, and tells the host', async () => {
    const work = sessionWithRepositories(1);
    const { sessions, dispatch, add, added } = harness(work);

    await expect(add()).resolves.toMatchObject({ sessionId: work.id });
    expect(sessions.insertCheckout).toHaveBeenCalledWith(work, added, expect.any(Array));
    expect(dispatch.addCheckout).toHaveBeenCalledWith(work, added, expect.anything());
  });

  it('refuses one past MAX_SESSION_CHECKOUTS with SESSIONS_010 and writes nothing', async () => {
    const { sessions, plan, dispatch, add } = harness(
      sessionWithRepositories(MAX_SESSION_CHECKOUTS),
    );

    await expect(add()).rejects.toMatchObject({ code: 'SESSIONS_010' });
    expect(plan.attachCheckout).not.toHaveBeenCalled();
    expect(sessions.insertCheckout).not.toHaveBeenCalled();
    expect(dispatch.addCheckout).not.toHaveBeenCalled();
  });
});
