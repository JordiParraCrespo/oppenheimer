import { Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectLookupPort } from '../../../../projects/application/project-lookup.port';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import type { SessionLaunchSpecFactory } from '../../../application/session-launch.factory';
import type { SessionPlanFactory } from '../../../application/session-plan.factory';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SessionCheckoutEntity } from '../../../domain/session-checkout.entity';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { AddCheckoutCommand } from '../add-checkout.command';
import { AddCheckoutCommandHandler } from '../add-checkout.command-handler';

/**
 * A session checks out one repository in the MVP (#56): a second is refused
 * here, before a row is written, rather than by the host after it was.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function sessionWithOneRepository() {
  const work = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'swift-wren-7gyezw',
    agent: 'claude-code',
  });
  work.attachCheckout(
    SessionCheckoutEntity.createNew({
      organizationId: 'org-acme',
      sessionId: work.id,
      installationId: 'installation-1',
      githubRepoId: '42',
      repositoryFullName: 'acme/xrp-mobile',
      directoryName: 'xrp-mobile',
      baseBranch: 'main',
      branch: 'oppenheimer/xrp-mobile/swift-wren-7gyezw',
    }),
  );
  return work;
}

describe('AddCheckoutCommandHandler', () => {
  it('refuses a second repository with SESSIONS_010 and writes nothing', async () => {
    const work = sessionWithOneRepository();
    const sessions = {
      findOneById: vi.fn().mockResolvedValue(Some(work)),
      insertCheckout: vi.fn(),
    } as unknown as WorkSessionRepositoryPort;
    const plan = { attachCheckout: vi.fn() } as unknown as SessionPlanFactory;
    const dispatch = { addCheckout: vi.fn() } as unknown as SessionDispatchPort;
    const handler = new AddCheckoutCommandHandler(
      sessions,
      { findActive: vi.fn() } as unknown as ProjectLookupPort,
      dispatch,
      plan,
      {} as SessionLaunchSpecFactory,
    );

    await expect(
      handler.execute(
        new AddCheckoutCommand({
          scope: SCOPE,
          sessionId: work.id,
          input: { installationId: 'installation-1', githubRepoId: 43 },
        }),
      ),
    ).rejects.toMatchObject({ code: 'SESSIONS_010' });
    expect(plan.attachCheckout).not.toHaveBeenCalled();
    expect(sessions.insertCheckout).not.toHaveBeenCalled();
    expect(dispatch.addCheckout).not.toHaveBeenCalled();
  });
});
