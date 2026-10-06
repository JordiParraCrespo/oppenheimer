import type { AccessScope } from '@oppenheimer/backend-authz';
import { describe, expect, it, vi } from 'vitest';
import type {
  PullRequestAccessPort,
  WorkspaceRepository,
} from '../../../github/application/pull-request-access.port';
import type {
  RepositoryWatch,
  WatchedRepositoryRepositoryPort,
} from '../../database/watched-repository.repository.port';
import { WatchedRepositoriesResolver } from '../watched-repositories.resolver';

const SCOPE: AccessScope = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

const repository = (githubRepoId: number, fullName: string): WorkspaceRepository => ({
  installationId: 'installation-1',
  githubRepoId,
  name: fullName.split('/')[1] as string,
  fullName,
  defaultBranch: 'main',
  private: false,
});

const MOBILE = repository(1, 'acme/xrp-mobile');
const WEB = repository(2, 'acme/xrp-web');

function resolverWith(watches: RepositoryWatch[]) {
  return new WatchedRepositoriesResolver(
    { repositories: vi.fn().mockResolvedValue([MOBILE, WEB]) } as unknown as PullRequestAccessPort,
    { findOwn: vi.fn().mockResolvedValue(watches) } as unknown as WatchedRepositoryRepositoryPort,
  );
}

// Watching is opt-in: a repository the person never picked is not watched.
// Flipping the default back would fill every new queue with every repository.
describe('WatchedRepositoriesResolver', () => {
  it('watches nothing until the person picks a repository', async () => {
    const resolver = resolverWith([]);

    expect((await resolver.all(SCOPE)).map((entry) => entry.watching)).toEqual([false, false]);
    expect(await resolver.watched(SCOPE)).toEqual([]);
  });

  it('watches exactly the repositories with a watch row', async () => {
    const resolver = resolverWith([{ installationId: 'installation-1', githubRepoId: 2 }]);

    expect(await resolver.watched(SCOPE)).toEqual([WEB]);
  });
});
