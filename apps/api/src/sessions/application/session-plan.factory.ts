import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { CreateSessionDto, SessionCheckoutInputDto } from '@oppenheimer/shared';
import { GithubErrors } from '../../github/domain/github.errors';
import type { GithubRepository } from '../../github/infrastructure/github-app.port';
import { ListInstallationRepositoriesQuery } from '../../github/queries/list-installation-repositories/list-installation-repositories.query';
import type { ProjectLookupPort } from '../../projects/application/project-lookup.port';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { PROJECT_LOOKUP } from '../../projects/projects.di-tokens';
import { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import { checkoutDirectoryName, sessionBranchName } from '../domain/session-layout.policy';
import { SessionErrors } from '../domain/sessions.errors';
import type { WorkSessionEntity } from '../domain/work-session.entity';

/**
 * Turns "start a session on these repositories" into the rows that describe it.
 *
 * It lives in `application/` because it needs ports and is not a use case: both
 * `POST /sessions` and `POST /sessions/{id}/checkouts` build a checkout the same
 * way, and the rules they share — which project the work belongs to, what the
 * directory is called, what the branch is called — are the ones that must not be
 * written twice.
 *
 * The repository's own name comes from GitHub, live, through the same listing the
 * picker reads (cached a minute). There is no repository table to look it up in:
 * GitHub owns the list, and a name that is a minute old is what a display snapshot
 * is for.
 */
@Injectable()
export class SessionPlanFactory {
  constructor(
    private readonly queryBus: QueryBus,
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
  ) {}

  /**
   * The project this session belongs in: the one the caller named, or the one whose
   * origin is the first checkout's repository — created on the spot if that
   * repository has never had a session.
   *
   * The console shows no project chip, which is why the second path exists: a fifth
   * chip on the most-used screen, for a concept with one instance, is real friction.
   */
  async resolveProject(
    scope: AccessScope,
    input: Pick<CreateSessionDto, 'projectId' | 'checkouts'>,
  ): Promise<ProjectEntity> {
    if (input.projectId) {
      const named = await this.projects.findOneById(scope, input.projectId);
      if (named.isNone()) {
        throw new AppError(SessionErrors.PROJECT_ARCHIVED, {
          detail: `No project with id ${input.projectId} that work can be put in`,
        });
      }
      return named.unwrap();
    }

    const first = input.checkouts[0];
    if (!first) throw new AppError(SessionErrors.PROJECT_REQUIRED);

    const repository = await this.repositoryOf(scope, first);
    const [owner] = repository.fullName.split('/');
    return this.projects.ensureForRepository(scope, {
      githubRepoId: String(repository.githubRepoId),
      owner,
      name: repository.name,
    });
  }

  /**
   * Build a checkout and attach it to the session.
   *
   * The directory name is derived over every name the session has **ever** used,
   * retired ones included, so a name is never reissued inside a session: the coding
   * agents key their conversation state by working directory, and a new checkout
   * landing on a retired name would inherit a stranger's history.
   */
  async attachCheckout(
    scope: AccessScope,
    session: WorkSessionEntity,
    project: ProjectEntity,
    input: SessionCheckoutInputDto,
  ): Promise<SessionCheckoutEntity> {
    const repository = await this.repositoryOf(scope, input);
    const checkout = SessionCheckoutEntity.createNew({
      organizationId: session.organizationId,
      sessionId: session.id,
      installationId: input.installationId,
      githubRepoId: String(repository.githubRepoId),
      repositoryFullName: repository.fullName,
      directoryName: checkoutDirectoryName(
        repository.fullName,
        String(repository.githubRepoId),
        session.usedDirectoryNames,
      ),
      // The base defaults to the repository's default branch; the session's own
      // branch is created from it and is never the base itself.
      baseBranch: input.baseBranch ?? repository.defaultBranch,
      branch: sessionBranchName(project.slug, session.slug),
    });
    session.attachCheckout(checkout);
    return checkout;
  }

  /**
   * One repository of one installation, as GitHub answers for it right now.
   *
   * The installation is read under the caller's own scope inside that query, so a
   * checkout through another workspace's installation is refused here as well as
   * being unrepresentable in the schema.
   */
  private async repositoryOf(
    scope: AccessScope,
    input: SessionCheckoutInputDto,
  ): Promise<GithubRepository> {
    const repositories = await this.queryBus.execute<
      ListInstallationRepositoriesQuery,
      GithubRepository[]
    >(new ListInstallationRepositoriesQuery({ scope, installationId: input.installationId }));

    const repository = repositories.find(
      (candidate) => candidate.githubRepoId === input.githubRepoId,
    );
    if (!repository) {
      throw new AppError(GithubErrors.REPOSITORY_NOT_IN_INSTALLATION, {
        detail: `Repository ${input.githubRepoId} is not one this installation covers`,
      });
    }
    return repository;
  }
}
