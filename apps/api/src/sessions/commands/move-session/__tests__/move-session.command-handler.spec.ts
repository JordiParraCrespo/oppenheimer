import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectLookupPort } from '../../../../projects/application/project-lookup.port';
import { ProjectEntity } from '../../../../projects/domain/project.entity';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SessionCheckoutEntity } from '../../../domain/session-checkout.entity';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { MoveSessionCommand } from '../move-session.command';
import { MoveSessionCommandHandler } from '../move-session.command-handler';

const SCOPE: AccessScope = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function project(id: string, githubRepoIds: string[]): ProjectEntity {
  return ProjectEntity.create({
    id,
    props: {
      organizationId: 'org-acme',
      name: `Project ${id}`,
      slug: id,
      archivedAt: null,
      createdByUserId: 'user-1',
      defaultHostId: null,
      defaultAgent: null,
      instructions: '',
      repositories: githubRepoIds.map((githubRepoId, index) => ({
        installationId: 'installation-1',
        githubRepoId,
        repositoryFullName: `acme/repo-${githubRepoId}`,
        baseBranch: 'main',
        isDefault: index === 0,
      })),
    },
  });
}

function session(githubRepoIds: string[]): WorkSessionEntity {
  const work = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'home',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
  });
  for (const githubRepoId of githubRepoIds) {
    work.attachCheckout(
      SessionCheckoutEntity.createNew({
        organizationId: 'org-acme',
        sessionId: work.id,
        installationId: 'installation-1',
        githubRepoId,
        repositoryFullName: `acme/repo-${githubRepoId}`,
        directoryName: `repo-${githubRepoId}`,
        baseBranch: 'main',
        branch: `oppenheimer/home/${work.slug}`,
      }),
    );
  }
  return work;
}

describe('MoveSessionCommandHandler', () => {
  let work: WorkSessionEntity;
  let sessions: WorkSessionRepositoryPort;
  let projects: ProjectLookupPort;
  let handler: MoveSessionCommandHandler;

  beforeEach(() => {
    work = session(['42']);
    sessions = {
      findOneById: vi.fn(async () => Some(work)),
      appendMove: vi.fn(async (moved: WorkSessionEntity, target: string, events) => {
        moved.recordEvent({
          seq: 9,
          kind: events[0].kind,
          payload: events[0].payload,
          occurredAt: new Date(),
        });
        expect(target).toBe(events[0].payload.to);
        return 'moved' as const;
      }),
    } as unknown as WorkSessionRepositoryPort;
    projects = {
      findOneById: vi.fn(async (_scope: AccessScope, id: string) =>
        Some(id === 'narrow' ? project('narrow', ['7']) : project(id, ['42', '7'])),
      ),
    } as unknown as ProjectLookupPort;
    handler = new MoveSessionCommandHandler(sessions, projects);
  });

  const move = (projectId: string) =>
    handler.execute(new MoveSessionCommand({ scope: SCOPE, sessionId: work.id, projectId }));

  it('lists the session under the target', async () => {
    const { session: moved, hints } = await move('wide');

    expect(moved.projectId).toBe('wide');
    expect(hints).toEqual([]);
    expect(vi.mocked(sessions.appendMove).mock.calls[0][2]).toEqual([
      expect.objectContaining({
        kind: SESSION_EVENT_KINDS.MOVED,
        source: 'api',
        payload: { from: 'home', to: 'wide' },
      }),
    ]);
  });

  it('moves a session to a project that does not hold its repository', async () => {
    // No membership rule: a project's repositories are suggestions, and a
    // session may work on any repository in any project.
    expect((await move('narrow')).session.projectId).toBe('narrow');
    expect(sessions.appendMove).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when the session is already there', async () => {
    await move('home');

    expect(projects.findOneById).not.toHaveBeenCalled();
    expect(sessions.appendMove).not.toHaveBeenCalled();
  });

  it('refuses a closed session', async () => {
    work.recordEvent({
      seq: 1,
      kind: SESSION_EVENT_KINDS.CLOSED,
      payload: {},
      occurredAt: new Date(),
    });

    await expect(move('wide')).rejects.toMatchObject({ code: 'SESSIONS_005' });
  });

  it('reports a target the caller cannot see as not found', async () => {
    vi.mocked(projects.findOneById).mockResolvedValue(None);

    await expect(move('elsewhere')).rejects.toMatchObject({ code: 'PROJECTS_001' });
  });

  it('refuses when an archive of the target committed first', async () => {
    vi.mocked(sessions.appendMove).mockResolvedValue('project-archived');

    await expect(move('wide')).rejects.toMatchObject({ code: 'SESSIONS_006' });
  });
});
