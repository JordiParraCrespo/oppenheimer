import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectLookupPort } from '../../../../projects/application/project-lookup.port';
import { ProjectRepositoryEntity } from '../../../../projects/domain/project-repository.entity';
import { ProjectEntity } from '../../../../projects/domain/project.entity';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SessionCheckoutEntity } from '../../../domain/session-checkout.entity';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { MoveSessionCommand } from '../move-session.command';
import { MoveSessionCommandHandler } from '../move-session.command-handler';

const scope: AccessScope = {
  userId: 'member-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function project(id: string, repositories: string[]) {
  const entity = ProjectEntity.createNew({
    organizationId: 'org-acme',
    name: id,
    slug: id,
    repositories: repositories.map((githubRepoId) =>
      ProjectRepositoryEntity.createNew({
        installationId: 'inst-1',
        githubRepoId,
        fullName: `acme/repo-${githubRepoId}`,
      }),
    ),
  });
  Object.defineProperty(entity, 'id', { value: id });
  return entity;
}

function session() {
  const entity = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'from',
    createdByUserId: 'member-1',
    hostId: 'host-1',
    slug: 'brave-otter-a1b2c3',
    agent: 'claude-code',
    idempotencyKey: 'key-1',
  });
  entity.attachCheckout(
    SessionCheckoutEntity.createNew({
      organizationId: 'org-acme',
      sessionId: entity.id,
      installationId: 'inst-1',
      githubRepoId: '42',
      repositoryFullName: 'acme/repo-42',
      directoryName: 'repo-42',
      baseBranch: 'main',
      branch: 'oppenheimer/from/brave-otter-a1b2c3',
    }),
  );
  return entity;
}

describe('MoveSessionCommandHandler', () => {
  let sessions: Pick<WorkSessionRepositoryPort, 'findOneById' | 'appendEvents'>;
  let projects: Pick<ProjectLookupPort, 'findOneById'>;
  let handler: MoveSessionCommandHandler;
  let current: WorkSessionEntity;

  beforeEach(() => {
    current = session();
    sessions = {
      findOneById: vi.fn().mockResolvedValue(Some(current)),
      appendEvents: vi.fn().mockResolvedValue({ accepted: [], rejected: [], appended: [] }),
    };
    projects = { findOneById: vi.fn().mockResolvedValue(Some(project('to', ['42', '7']))) };
    handler = new MoveSessionCommandHandler(
      sessions as WorkSessionRepositoryPort,
      projects as ProjectLookupPort,
    );
  });

  const command = (projectId = 'to') =>
    new MoveSessionCommand({ scope, sessionId: current.id, projectId });

  it('records the move as one event the row folds, and tells no host', async () => {
    const result = await handler.execute(command());

    expect(result.hints).toEqual([]);
    expect(sessions.appendEvents).toHaveBeenCalledWith(current, [
      expect.objectContaining({
        kind: SESSION_EVENT_KINDS.MOVED,
        source: 'api',
        payload: { projectId: 'to', fromProjectId: 'from' },
      }),
    ]);
  });

  it('refuses a project that does not hold every repository the session checked out', async () => {
    vi.mocked(projects.findOneById).mockResolvedValue(Some(project('to', ['7'])));

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_018' });
    expect(sessions.appendEvents).not.toHaveBeenCalled();
  });

  it('is a no-op when the session is already in that project', async () => {
    await handler.execute(command('from'));

    expect(projects.findOneById).not.toHaveBeenCalled();
    expect(sessions.appendEvents).not.toHaveBeenCalled();
  });

  it('reports a project the scope cannot see, or has retired, as not found', async () => {
    vi.mocked(projects.findOneById).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_001' });
  });

  it('refuses a closed session', async () => {
    vi.spyOn(current, 'isResolved', 'get').mockReturnValue(true);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_005' });
  });
});
