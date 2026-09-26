import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { ProjectRepositoryDto } from '@oppenheimer/shared';
import type { RepositoryAccessPort } from '../../github/application/repository-access.port';
import { REPOSITORY_ACCESS } from '../../github/github.di-tokens';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../hosts/hosts.di-tokens';
import { ProjectRepositoryEntity } from '../domain/project-repository.entity';

/**
 * What the project dialog names, checked against what the workspace can reach.
 *
 * A repository row is a claim — "this installation covers that repository" —
 * and GitHub is the one who can confirm it, exactly as on a session checkout:
 * an installation another workspace holds is `GITHUB_001` through the scoped
 * read, a suspended one `GITHUB_008`, a repository the installation does not
 * cover `GITHUB_010`. The confirmed row records the repository's full name as
 * GitHub spells it, so the console prints it without a call of its own.
 *
 * The default host is checked the same way a session's host is: out of scope
 * or unpaired reads as `HOSTS_001`.
 */
@Injectable()
export class ProjectRepositoriesResolver {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly repositories: RepositoryAccessPort,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
  ) {}

  async resolveRepositories(
    scope: AccessScope,
    rows: readonly ProjectRepositoryDto[],
  ): Promise<ProjectRepositoryEntity[]> {
    // One at a time, in the order given: the order is the order the dialog
    // listed them, and it is what the slug is derived from.
    const resolved: ProjectRepositoryEntity[] = [];
    for (const row of rows) {
      const repository = await this.repositories.repositoryOf(
        scope,
        row.installationId,
        row.githubRepoId,
      );
      resolved.push(
        ProjectRepositoryEntity.createNew({
          installationId: row.installationId,
          githubRepoId: String(repository.githubRepoId),
          fullName: repository.fullName,
          isDefault: row.isDefault,
          baseBranch: row.baseBranch ?? null,
        }),
      );
    }
    return resolved;
  }

  async assertHost(scope: AccessScope, hostId: string | null | undefined): Promise<void> {
    if (!hostId) return;
    await this.hosts.assertUsable(scope, hostId);
  }
}
