import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import { ProjectEntity } from '../../domain/project.entity';
import { ProjectLookupResolver } from '../project-lookup.resolver';

const SCOPE: AccessScope = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function project(): ProjectEntity {
  return ProjectEntity.createNew({
    organizationId: 'org-acme',
    name: 'Atlas',
    slug: 'atlas',
    repositories: [
      {
        installationId: 'installation-1',
        githubRepoId: '42',
        repositoryFullName: 'acme/atlas',
        baseBranch: 'main',
        isDefault: true,
      },
    ],
  });
}

describe('ProjectLookupResolver', () => {
  const resolverFor = (found: ReturnType<typeof Some<ProjectEntity>> | typeof None) =>
    new ProjectLookupResolver({
      findOneById: vi.fn().mockResolvedValue(found),
    } as unknown as ProjectRepositoryPort);

  it('hands back an active project the caller can see', async () => {
    const atlas = project();

    expect((await resolverFor(Some(atlas)).findOneById(SCOPE, atlas.id)).unwrap()).toBe(atlas);
  });

  it('reads an archived project as absent: nothing new is listed under it', async () => {
    const atlas = project();
    atlas.archive(new Date());

    expect((await resolverFor(Some(atlas)).findOneById(SCOPE, atlas.id)).isNone()).toBe(true);
  });

  it('passes a miss through', async () => {
    expect((await resolverFor(None).findOneById(SCOPE, 'nope')).isNone()).toBe(true);
  });
});
