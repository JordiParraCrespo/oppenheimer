import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectRepositoryInputDto } from '@oppenheimer/shared';
import type { RepositoryAccessPort } from '../../github/application/repository-access.port';
import { REPOSITORY_ACCESS } from '../../github/github.di-tokens';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../hosts/hosts.di-tokens';
import {
  type ProjectRepositoryProps,
  projectRepositoriesProblem,
} from '../domain/project-repositories.policy';
import { ProjectErrors } from '../domain/projects.errors';

/**
 * Turns what a person asked a project to hold into what the project may hold.
 *
 * It lives in `application/` because it needs two other modules' ports and is not
 * a use case: creating a project and changing one resolve their settings the same
 * way, and the rules they share must not be written twice.
 *
 *  - **Repositories are asked about live.** GitHub owns what a repository is
 *    called and whether the workspace's installation still covers it, so each
 *    one is resolved through `RepositoryAccessPort` on every write — its 404 is
 *    the refusal — and the name the project keeps is a display snapshot of the
 *    answer. There is still no repository table.
 *  - **A default host must be one the caller can use** when it is set. The
 *    default is a suggestion, never a grant, and a session on it is checked again
 *    at create; refusing an unusable one here only keeps the column from naming a
 *    host nobody in the conversation could have picked.
 */
@Injectable()
export class ProjectSettingsResolver {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly github: RepositoryAccessPort,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
  ) {}

  async repositories(
    scope: AccessScope,
    inputs: readonly ProjectRepositoryInputDto[],
  ): Promise<ProjectRepositoryProps[]> {
    // The list's own shape first: it is decidable without GitHub, and a refusal
    // should not cost a round-trip per repository.
    assertHoldable(
      inputs.map((input) => ({
        installationId: input.installationId,
        githubRepoId: String(input.githubRepoId),
        repositoryFullName: '',
        baseBranch: input.baseBranch,
        isDefault: input.isDefault,
      })),
    );

    return Promise.all(
      inputs.map(async (input) => {
        const repository = await this.github.repositoryOf(
          scope,
          input.installationId,
          input.githubRepoId,
        );
        return {
          installationId: input.installationId,
          githubRepoId: String(repository.githubRepoId),
          repositoryFullName: repository.fullName,
          baseBranch: input.baseBranch.trim(),
          isDefault: input.isDefault,
        };
      }),
    );
  }

  /** Throws the hosts module's not-found problem for a host the caller cannot use. */
  async assertUsableHost(scope: AccessScope, hostId: string | null | undefined): Promise<void> {
    if (hostId) await this.hosts.assertUsable(scope, hostId);
  }
}

/** The problem document for a list the aggregate would refuse, naming what is wrong. */
export function assertHoldable(repositories: readonly ProjectRepositoryProps[]): void {
  const problem = projectRepositoriesProblem(repositories);
  if (problem) {
    throw new AppError(ProjectErrors.INVALID_REPOSITORIES, { detail: PROBLEMS[problem] });
  }
}

const PROBLEMS = {
  empty: 'A project must hold at least one repository',
  'no-default': 'At least one of the project’s repositories must be a default',
  duplicate: 'A repository appears more than once',
  'too-many': 'A project holds at most 20 repositories',
  'blank-base': 'Every repository needs a base branch',
} as const;
