import { AppError } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import type { CloudRunsPort } from '../../../cloud-agents/application/cloud-runs.port';
import { CloudAgentErrors } from '../../../cloud-agents/domain/cloud-agents.errors';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SessionCloudRunEntity } from '../../domain/session-cloud-run.entity';
import { mintSessionSlug } from '../../domain/session-slug.policy';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { WorkSessionMapper } from '../../work-session.mapper';
import { CloudSessionSyncResolver } from '../cloud-session-sync.resolver';

/**
 * A read brings cloud sessions up to date with their vendor on a budget, on
 * the launcher's key: the stalest few working ones of a page, and a vendor
 * that fails leaves the session as last heard of. Which statuses write which
 * entries is the policy's (`cloud-session-sync.policy.spec.ts`).
 */

const NOW = new Date('2026-10-27T12:00:00Z');

function cloudSession(minutesAgo: number, status: 'running' | 'finished' = 'running') {
  const id = `session-${minutesAgo}-${status}`;
  return WorkSessionEntity.requestCloud({
    id,
    cloudRun: SessionCloudRunEntity.launched(
      {
        organizationId: 'org-acme',
        sessionId: id,
        provider: 'cursor',
        externalId: `bc-${id}`,
        url: null,
        repositoryUrl: 'https://github.com/acme/api',
        run: { runId: 'run-1', status, branch: null, pullRequestUrl: null, summary: null },
      },
      new Date(NOW.getTime() - minutesAgo * 60_000),
    ),
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'launcher',
    slug: mintSessionSlug(),
    agent: 'cursor',
  });
}

function setup(read: CloudRunsPort['read']) {
  const runs: CloudRunsPort = { launch: vi.fn(), read: vi.fn(read) };
  const sessions: Pick<WorkSessionRepositoryPort, 'saveCloudRunIf' | 'appendEvents'> = {
    saveCloudRunIf: vi.fn().mockResolvedValue(true),
    appendEvents: vi.fn(),
  };
  const resolver = new CloudSessionSyncResolver(
    runs,
    sessions as WorkSessionRepositoryPort,
    new WorkSessionMapper(),
  );
  return { resolver, runs, sessions };
}

const finished = async () => ({
  runId: 'run-1',
  status: 'finished' as const,
  branch: 'cursor/fix',
  pullRequestUrl: null,
  summary: 'Done.',
});

describe('CloudSessionSyncResolver', () => {
  it('asks about the stalest three working sessions of a page, on each launcher’s key', async () => {
    const page = [1, 5, 2, 4, 3].map((minutes) => cloudSession(minutes));
    page.push(cloudSession(9, 'finished'));
    const { resolver, runs } = setup(finished);

    await resolver.syncPage(page, NOW);

    const asked = vi.mocked(runs.read).mock.calls.map(([, , externalId]) => externalId);
    expect(asked.sort()).toEqual(
      ['bc-session-5-running', 'bc-session-4-running', 'bc-session-3-running'].sort(),
    );
    expect(vi.mocked(runs.read).mock.calls[0][0]).toEqual({
      organizationId: 'org-acme',
      userId: 'launcher',
    });
  });

  it('writes the run and the entries its status owes the log', async () => {
    const session = cloudSession(5);
    const { resolver, sessions } = setup(finished);

    await resolver.syncOne(session, NOW);

    expect(sessions.saveCloudRunIf).toHaveBeenCalledWith(session.cloudRun, 'run-1');
    expect(session.cloudRun).toMatchObject({ status: 'finished', branch: 'cursor/fix' });
    expect(vi.mocked(sessions.appendEvents).mock.calls[0][1].map((e) => e.idempotencyKey)).toEqual([
      'cloud:run-1:started',
      'cloud:run-1:observed:done',
    ]);
  });

  it('leaves a session as last heard of when its vendor fails, and asks nothing heard of just now', async () => {
    const { resolver, sessions, runs } = setup(async () => {
      throw new AppError(CloudAgentErrors.RATE_LIMITED);
    });

    await expect(resolver.syncOne(cloudSession(5), NOW)).resolves.toBeUndefined();
    expect(sessions.saveCloudRunIf).not.toHaveBeenCalled();
    expect(sessions.appendEvents).not.toHaveBeenCalled();

    vi.mocked(runs.read).mockClear();
    await resolver.syncOne(cloudSession(0), NOW);
    expect(runs.read).not.toHaveBeenCalled();
  });
});
