import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { CreateSessionDto, SessionCheckoutInputDto } from '@oppenheimer/shared';
import type { RepositoryAccessPort } from '../../github/application/repository-access.port';
import { REPOSITORY_ACCESS } from '../../github/github.di-tokens';
import type { GithubRepository } from '../../github/infrastructure/github-app.port';
import type { ProjectLookupPort } from '../../projects/application/project-lookup.port';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { PROJECT_LOOKUP } from '../../projects/projects.di-tokens';
import { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import { checkoutDirectoryName, sessionBranchName } from '../domain/session-layout.policy';
import { SessionErrors } from '../domain/sessions.errors';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import { requireActiveProject } from './require-active-project.policy';

/**
 * Turns "start a session on these repositories" into the rows that describe it.
 *
 * It lives in `application/` because it needs ports and is not a use case: both
 * `POST /sessions` and `POST /sessions/{id}/checkouts` build a checkout the same
 * way, and the rules they share — which project the work belongs to, what the
 * directory is called, what the branch is called — are the ones that must not be
 * written twice.
 *
 * The repository's own name comes from GitHub, live, one repository at a time.
 * There is no repository table to look it up in: GitHub owns the list, and what a
 * checkout keeps is a display snapshot of the name it had when it was created.
 */
@Injectable()
export class SessionPlanFactory {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly repositories: RepositoryAccessPort,
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
  ) {}

  /**
   * The project this session belongs in: the one the caller named, or the one whose
   * origin is the first checkout's repository — created on the spot if that
   * repository has never had a session.
   *
   * The console always names the project; the second path is for a caller that
   * names only a repository (`product/versions/mvp/12-projects.md`).
   */
  async resolveProject(
    scope: AccessScope,
    input: Pick<CreateSessionDto, 'projectId' | 'checkouts'>,
  ): Promise<ProjectEntity> {
    if (input.projectId) {
      return requireActiveProject(this.projects, scope, input.projectId);
    }

    const first = input.checkouts[0];
    if (!first) throw new AppError(SessionErrors.PROJECT_REQUIRED);

    const repository = await this.repositoryOf(scope, first);
    const [owner] = repository.fullName.split('/');
    return this.projects.ensureForRepository(scope, {
      githubRepoId: String(repository.githubRepoId),
      owner,
      name: repository.name,
      installationId: first.installationId,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
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
    const directoryName = checkoutDirectoryName(
      repository.fullName,
      String(repository.githubRepoId),
      session.usedDirectoryNames,
    );
    if (!directoryName) {
      throw new AppError(SessionErrors.CHECKOUT_NAMES_EXHAUSTED, {
        detail: `This session has used every directory name ${repository.fullName} can take`,
      });
    }

    const checkout = SessionCheckoutEntity.createNew({
      organizationId: session.organizationId,
      sessionId: session.id,
      installationId: input.installationId,
      githubRepoId: String(repository.githubRepoId),
      repositoryFullName: repository.fullName,
      directoryName,
      // The base defaults to the repository's default branch; the session's own
      // branch is created from it and is never the base itself.
      baseBranch: input.baseBranch ?? repository.defaultBranch,
      branch: sessionBranchName(project.slug, session.slug),
    });
    session.attachCheckout(checkout);
    return checkout;
  }

  /**
   * Where the agent starts: the checkout the caller named, or the first one when it
   * named none. Null only when the session has no checkouts at all, which starts it
   * in the session directory with every checkout a peer.
   *
   * There is **no fallback** for a `cwdGithubRepoId` that names nothing. The schema
   * already refuses that body, so reaching here means the schema has a hole — and
   * launching the agent in the wrong tree is a worse answer to that than an error.
   */
  cwdCheckoutIdFor(session: WorkSessionEntity, cwdGithubRepoId: number | undefined): string | null {
    const checkouts = session.liveCheckouts;
    if (cwdGithubRepoId === undefined) return checkouts[0]?.id ?? null;
    const named = checkouts.find((checkout) => checkout.githubRepoId === String(cwdGithubRepoId));
    if (!named) {
      throw new AppError(SessionErrors.CHECKOUT_NOT_FOUND, {
        detail: `This session does not check out repository ${cwdGithubRepoId}`,
      });
    }
    return named.id;
  }

  /**
   * One repository of one installation, as GitHub answers for it right now.
   *
   * It asks for **that repository**, not for the installation's catalogue: naming
   * one checkout is a lookup, and paging the picker's list to `find()` in it is a
   * different question with a different cost. GitHub's own 404 is the refusal when
   * the installation does not cover it, which is also the only authority on that.
   */
  private async repositoryOf(
    scope: AccessScope,
    input: SessionCheckoutInputDto,
  ): Promise<GithubRepository> {
    return this.repositories.repositoryOf(scope, input.installationId, input.githubRepoId);
  }
}
