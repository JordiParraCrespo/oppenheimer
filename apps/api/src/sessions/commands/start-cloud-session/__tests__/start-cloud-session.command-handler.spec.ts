import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { CloudRunsPort } from '../../../../cloud-agents/application/cloud-runs.port';
import { CloudAgentErrors } from '../../../../cloud-agents/domain/cloud-agents.errors';
import { ProjectEntity } from '../../../../projects/domain/project.entity';
import type { SessionNamingResolver } from '../../../application/session-naming.resolver';
import type { SessionPlanFactory } from '../../../application/session-plan.factory';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import type { WorkSessionEntity } from '../../../domain/work-session.entity';
import { WorkSessionMapper } from '../../../work-session.mapper';
import { StartCloudSessionCommand } from '../start-cloud-session.command';
import { StartCloudSessionCommandHandler } from '../start-cloud-session.command-handler';

/**
 * A cloud session asks its vendor first, on the caller's key, and stores the
 * session only once the vendor started its agent: a refusal stores nothing,
 * and a retry with the same key returns the session without asking again.
 * The database's half (no host, the run beside it) is the integration
 * suite's ("a cloud session").
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

const INPUT = {
  provider: 'cursor' as const,
  projectId: 'project-1',
  checkout: { installationId: 'installation-1', githubRepoId: 42 },
  prompt: 'Fix the login redirect loop',
  model: 'grok-4.7',
};

const project = ProjectEntity.createNew({
  organizationId: 'org-acme',
  name: 'api',
  slug: 'api',
  repositories: [],
});

function setup(launch: CloudRunsPort['launch'], existing?: WorkSessionEntity) {
  const sessions: Pick<WorkSessionRepositoryPort, 'findOneByIdempotencyKey' | 'createIfUnclaimed'> =
    {
      findOneByIdempotencyKey: vi.fn().mockResolvedValue(existing ? Some(existing) : None),
      createIfUnclaimed: vi.fn(async (session: WorkSessionEntity) => ({
        session,
        created: true,
        refused: null,
      })),
    };
  const runs: CloudRunsPort = { launch: vi.fn(launch), read: vi.fn() };
  const plan = {
    resolveProject: vi.fn().mockResolvedValue(project),
    cloudSourceOf: vi.fn().mockResolvedValue({
      repositoryUrl: 'https://github.com/acme/api',
      startingRef: 'main',
    }),
  } as unknown as SessionPlanFactory;
  const naming = {
    propose: vi.fn().mockResolvedValue(null),
    record: vi.fn(),
  } as unknown as SessionNamingResolver;
  const handler = new StartCloudSessionCommandHandler(
    sessions as WorkSessionRepositoryPort,
    runs,
    plan,
    naming,
    new WorkSessionMapper(),
  );
  return { handler, sessions, runs };
}

const command = (idempotencyKey: string | null = null) =>
  new StartCloudSessionCommand({
    scope: SCOPE,
    userId: 'user-1',
    input: INPUT,
    idempotencyKey,
    origin: 'person',
  });

describe('StartCloudSessionCommandHandler', () => {
  it('starts the vendor’s agent under the session’s id, then stores the session with its run and first entries', async () => {
    const { handler, sessions, runs } = setup(async (_owner, _provider, launch) => ({
      externalId: `bc-${launch.id}`,
      name: 'Fix the login redirect loop',
      url: `https://cursor.com/agents?id=bc-${launch.id}`,
      run: { runId: 'run-1', status: 'running', branch: null, pullRequestUrl: null, summary: null },
    }));

    const { sessionId } = await handler.execute(command());

    expect(runs.launch).toHaveBeenCalledWith(
      { organizationId: 'org-acme', userId: 'user-1' },
      'cursor',
      {
        id: sessionId,
        prompt: INPUT.prompt,
        repositoryUrl: 'https://github.com/acme/api',
        startingRef: 'main',
        model: 'grok-4.7',
      },
    );
    const [stored, events] = vi.mocked(sessions.createIfUnclaimed).mock.calls[0];
    expect(stored).toMatchObject({ id: sessionId, place: 'cloud', hostId: null, agent: 'cursor' });
    expect(stored.cloudRun).toMatchObject({ externalId: `bc-${sessionId}`, status: 'running' });
    expect(events.map((event) => event.kind)).toEqual([
      SESSION_EVENT_KINDS.REQUESTED,
      SESSION_EVENT_KINDS.PROMPT_FIRST,
      SESSION_EVENT_KINDS.STARTED,
      SESSION_EVENT_KINDS.AGENT_OBSERVED,
    ]);
  });

  it('stores nothing when the vendor refuses the launch', async () => {
    const { handler, sessions } = setup(async () => {
      throw new AppError(CloudAgentErrors.REQUEST_REFUSED, { detail: 'Cursor: Out of usage' });
    });

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'CLOUD_AGENTS_010' });
    expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();
  });

  it('answers a retry with the session it already started, without asking the vendor again', async () => {
    const existing = { id: 'session-1' } as WorkSessionEntity;
    const { handler, runs, sessions } = setup(vi.fn(), existing);

    await expect(handler.execute(command('key-1'))).resolves.toEqual({
      sessionId: 'session-1',
      hints: [],
    });
    expect(runs.launch).not.toHaveBeenCalled();
    expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();
  });
});
