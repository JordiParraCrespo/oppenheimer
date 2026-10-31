import { Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SessionCloudRunEntity } from '../../domain/session-cloud-run.entity';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionLoaderResolver } from '../session-loader.resolver';

/**
 * What a host-only command (a terminal, a checkout, a restart, a share) asks
 * first: a cloud session runs at its vendor, so it is refused with
 * `SESSIONS_039` before anything is sent anywhere; a host session passes.
 */

const SCOPE = { userId: 'user-1', organizationId: 'org-acme' } as unknown as AccessScope;

const cloud = WorkSessionEntity.requestCloud({
  id: 'cloud-1',
  cloudRun: SessionCloudRunEntity.launched(
    {
      organizationId: 'org-acme',
      sessionId: 'cloud-1',
      provider: 'cursor',
      externalId: 'bc-cloud-1',
      url: null,
      repositoryUrl: 'https://github.com/acme/api',
      run: { runId: 'run-1', status: 'running', branch: null, pullRequestUrl: null, summary: null },
    },
    new Date(),
  ),
  organizationId: 'org-acme',
  projectId: 'project-1',
  createdByUserId: 'user-1',
  slug: 'bold-otter-3f9a7k',
  agent: 'cursor',
});

const host = WorkSessionEntity.request({
  organizationId: 'org-acme',
  projectId: 'project-1',
  createdByUserId: 'user-1',
  hostId: 'host-1',
  slug: 'calm-heron-2b8c1d',
  agent: 'claude-code',
});

function loaderOf(session: WorkSessionEntity) {
  const sessions: Pick<WorkSessionRepositoryPort, 'findOneById'> = {
    findOneById: vi.fn().mockResolvedValue(Some(session)),
  };
  return new SessionLoaderResolver(sessions as WorkSessionRepositoryPort);
}

describe('SessionLoaderResolver.requireLiveOnHost', () => {
  it('refuses a cloud session with SESSIONS_039', async () => {
    await expect(loaderOf(cloud).requireLiveOnHost(SCOPE, cloud.id)).rejects.toMatchObject({
      code: 'SESSIONS_039',
    });
  });

  it('answers a host session with its host', async () => {
    const session = await loaderOf(host).requireLiveOnHost(SCOPE, host.id);
    expect(session.hostId).toBe('host-1');
  });
});
