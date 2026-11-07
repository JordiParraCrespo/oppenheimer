import { Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import type { ProjectLookupPort } from '../../../../projects/application/project-lookup.port';
import { ProjectEntity } from '../../../../projects/domain/project.entity';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import type { SessionLaunchSpecFactory } from '../../../application/session-launch.factory';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { RetrySessionCommand } from '../retry-session.command';
import { RetrySessionCommandHandler } from '../retry-session.command-handler';

/**
 * Try again under "The session did not start" sends the host the same create,
 * with the first task the log kept, and only for a start that failed.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function session(failed: boolean) {
  const work = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-thistle-rnr3rj',
    agent: 'claude-code',
  });
  work.recordEvent({
    seq: 1,
    kind: SESSION_EVENT_KINDS.REQUESTED,
    payload: {},
    occurredAt: new Date(),
  });
  if (failed) {
    work.recordEvent({
      seq: 2,
      kind: SESSION_EVENT_KINDS.FAILED,
      payload: { code: 'SESS_019' },
      occurredAt: new Date(),
    });
  }
  return work;
}

function project() {
  return ProjectEntity.createNew({
    organizationId: 'org-acme',
    name: 'oppenheimer',
    slug: 'oppenheimer',
    repositories: [
      {
        installationId: 'installation-1',
        githubRepoId: '42',
        repositoryFullName: 'acme/oppenheimer',
        baseBranch: 'main',
        isDefault: true,
      },
    ],
  });
}

describe('RetrySessionCommandHandler', () => {
  let sessions: {
    findOneById: ReturnType<typeof vi.fn>;
    appendEventsIf: ReturnType<typeof vi.fn>;
    findFirstPrompt: ReturnType<typeof vi.fn>;
  };
  let dispatch: { create: ReturnType<typeof vi.fn> };
  let launches: { build: ReturnType<typeof vi.fn> };
  let handler: RetrySessionCommandHandler;

  function given(work: WorkSessionEntity) {
    sessions.findOneById.mockResolvedValue(Some(work));
    return new RetrySessionCommand({ scope: SCOPE, sessionId: work.id });
  }

  beforeEach(() => {
    sessions = {
      findOneById: vi.fn(),
      appendEventsIf: vi.fn().mockResolvedValue({}),
      findFirstPrompt: vi.fn().mockResolvedValue({ prompt: 'Bot tool parameter limits' }),
    };
    const projects = {
      findOneById: vi.fn().mockResolvedValue(Some(project())),
    } as unknown as ProjectLookupPort;
    const hosts = { assertUsable: vi.fn().mockResolvedValue({ probedTools: null }) };
    dispatch = { create: vi.fn().mockResolvedValue({ delivered: true, hints: [] }) };
    launches = { build: vi.fn().mockResolvedValue({ prompt: 'Bot tool parameter limits' }) };
    handler = new RetrySessionCommandHandler(
      new SessionLoaderResolver(sessions as unknown as WorkSessionRepositoryPort),
      sessions as unknown as WorkSessionRepositoryPort,
      projects,
      hosts as unknown as HostAccessPort,
      dispatch as unknown as SessionDispatchPort,
      launches as unknown as SessionLaunchSpecFactory,
    );
  });

  it('records the retry and sends the same create with the first task the log kept', async () => {
    const work = session(true);
    await expect(handler.execute(given(work))).resolves.toEqual({ sessionId: work.id, hints: [] });

    expect(sessions.appendEventsIf).toHaveBeenCalledWith(
      work,
      [expect.objectContaining({ kind: SESSION_EVENT_KINDS.RETRY_REQUESTED, source: 'api' })],
      expect.any(Function),
    );
    // Regression: a retry that dropped the task started an agent with nothing to do.
    expect(launches.build).toHaveBeenCalledWith(work, { prompt: 'Bot tool parameter limits' });
    expect(dispatch.create).toHaveBeenCalledOnce();
  });

  it('refuses with SESSIONS_052, and sends nothing, for a session whose start did not fail', async () => {
    await expect(handler.execute(given(session(false)))).rejects.toMatchObject({
      code: 'SESSIONS_052',
    });
    expect(sessions.appendEventsIf).not.toHaveBeenCalled();
    expect(dispatch.create).not.toHaveBeenCalled();
  });

  it('sends one create when two presses race: the one that lost the append sends none', async () => {
    sessions.appendEventsIf.mockResolvedValue(null);
    await handler.execute(given(session(true)));
    expect(dispatch.create).not.toHaveBeenCalled();
  });
});
