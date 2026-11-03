import { describe, expect, it, vi } from 'vitest';
import type { ProjectRepositoryPort } from '../../../database/project.repository.port';
import { ProjectEntity } from '../../../domain/project.entity';
import { RestoreProjectCommand } from '../restore-project.command';
import { RestoreProjectCommandHandler } from '../restore-project.command-handler';

/**
 * Restoring answers the project whether it was archived or already active, so
 * a retry is not a conflict, and a project the caller's scope does not reach
 * is not found. The lock and the write are the repository's
 * (`projects.integration.spec.ts`).
 */
const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

const project = () =>
  ProjectEntity.createNew({
    organizationId: 'org-acme',
    name: 'local SEO',
    slug: 'local-seo',
    repositories: [],
  });

function handlerAnswering(
  outcome: Awaited<ReturnType<ProjectRepositoryPort['restoreIfArchived']>>,
) {
  const projects: Pick<ProjectRepositoryPort, 'restoreIfArchived'> = {
    restoreIfArchived: vi.fn(async () => outcome),
  };
  return {
    projects,
    handler: new RestoreProjectCommandHandler(projects as ProjectRepositoryPort),
  };
}

describe('RestoreProjectCommandHandler', () => {
  it.each(['restored', 'active'] as const)('answers the project when it is %s', async (result) => {
    const restored = project();
    const { projects, handler } = handlerAnswering({ result, project: restored });

    const answer = await handler.execute(
      new RestoreProjectCommand({ scope: SCOPE, projectId: restored.id }),
    );

    expect(answer).toBe(restored);
    expect(projects.restoreIfArchived).toHaveBeenCalledWith(SCOPE, restored.id);
  });

  it('refuses a project the scope does not reach with PROJECTS_001', async () => {
    const { handler } = handlerAnswering({ result: 'not-found' });

    await expect(
      handler.execute(new RestoreProjectCommand({ scope: SCOPE, projectId: 'p-1' })),
    ).rejects.toMatchObject({ code: 'PROJECTS_001' });
  });
});
