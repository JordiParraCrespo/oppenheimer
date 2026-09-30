import { AppError } from '@oppenheimer/backend-core';
import { Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import { HostErrors } from '../../../../hosts/domain/hosts.errors';
import type { ProjectLookupPort } from '../../../../projects/application/project-lookup.port';
import { ProjectEntity } from '../../../../projects/domain/project.entity';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import type { SessionLaunchSpecFactory } from '../../../application/session-launch.factory';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { RestartSessionCommand } from '../restart-session.command';
import { RestartSessionCommandHandler } from '../restart-session.command-handler';

/**
 * Restart starts the agent again on the session's host, so it asks the same
 * question a create does: may the caller still use that host?
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

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

function project() {
  return ProjectEntity.createNew({
    organizationId: 'org-acme',
    name: 'xrp-mobile',
    slug: 'xrp-mobile',
    repositories: [
      {
        installationId: 'installation-1',
        githubRepoId: '42',
        repositoryFullName: 'acme/xrp-mobile',
        baseBranch: 'main',
        isDefault: true,
      },
    ],
  });
}

describe('RestartSessionCommandHandler', () => {
  let sessions: { findOneById: ReturnType<typeof vi.fn>; appendEvents: ReturnType<typeof vi.fn> };
  let hosts: { assertUsable: ReturnType<typeof vi.fn> };
  let dispatch: { restart: ReturnType<typeof vi.fn> };
  let handler: RestartSessionCommandHandler;
  let work: WorkSessionEntity;

  beforeEach(() => {
    work = session();
    sessions = {
      findOneById: vi.fn().mockResolvedValue(Some(work)),
      appendEvents: vi.fn().mockResolvedValue(undefined),
    };
    const projects = {
      findOneById: vi.fn().mockResolvedValue(Some(project())),
    } as unknown as ProjectLookupPort;
    hosts = { assertUsable: vi.fn().mockResolvedValue({ probedTools: null }) };
    dispatch = { restart: vi.fn().mockResolvedValue({ delivered: true, hints: [] }) };
    const launches = { build: vi.fn().mockResolvedValue({}) };
    handler = new RestartSessionCommandHandler(
      new SessionLoaderResolver(sessions as unknown as WorkSessionRepositoryPort),
      sessions as unknown as WorkSessionRepositoryPort,
      projects,
      hosts as unknown as HostAccessPort,
      dispatch as unknown as SessionDispatchPort,
      launches as unknown as SessionLaunchSpecFactory,
    );
  });

  const command = () => new RestartSessionCommand({ scope: SCOPE, sessionId: work.id });

  it('records the request and dispatches it on a host the caller can still use', async () => {
    await expect(handler.execute(command())).resolves.toEqual({ sessionId: work.id, hints: [] });

    expect(hosts.assertUsable).toHaveBeenCalledWith(SCOPE, 'host-1');
    // A request, not an outcome: the session opens when the host says it did.
    expect(sessions.appendEvents).toHaveBeenCalledWith(work, [
      expect.objectContaining({ kind: SESSION_EVENT_KINDS.RESTART_REQUESTED, source: 'api' }),
    ]);
    expect(dispatch.restart).toHaveBeenCalledOnce();
  });

  it('refuses with HOSTS_001, and records and dispatches nothing, once the host is out of reach', async () => {
    hosts.assertUsable.mockRejectedValue(new AppError(HostErrors.NOT_FOUND));

    // Regression: a caller whose grant was revoked could still start the agent
    // again on the machine.
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(sessions.appendEvents).not.toHaveBeenCalled();
    expect(dispatch.restart).not.toHaveBeenCalled();
  });
});
