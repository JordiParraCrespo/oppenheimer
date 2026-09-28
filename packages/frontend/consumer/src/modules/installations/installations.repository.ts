import {
  heyApiSdk,
  type InstallationResponseDto,
  type RepositoryBranchResponseDto,
  type RepositoryResponseDto,
} from '@oppenheimer/api-client';
import { MapApiError, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import {
  BranchEntity,
  type InstallationCallback,
  InstallationEntity,
  type InstallationStart,
  RepositoryEntity,
} from './installation.entity';
import { InstallationsErrors } from './installations.errors';

/** The wire shapes are the generated client's, never mirrored here. */
type InstallationDto = InstallationResponseDto;
type RepositoryDto = RepositoryResponseDto;

function toEntity(data: InstallationDto): InstallationEntity {
  return new InstallationEntity(
    data.id,
    data.organizationId,
    data.githubInstallationId,
    data.accountLogin,
    data.accountType,
    data.repositorySelection,
    new Date(data.createdAt),
  );
}

function toRepository(data: RepositoryDto): RepositoryEntity {
  return new RepositoryEntity(
    data.githubRepoId,
    data.name,
    data.fullName,
    data.defaultBranch,
    data.private,
    data.archived,
    data.pushedAt ? new Date(data.pushedAt) : null,
  );
}

@injectable()
export class InstallationsRepository {
  @MapApiError(InstallationsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<InstallationEntity[]> {
    // An absent body is a failed read, not an empty list — returning `[]` would
    // render "GitHub is not connected" over a request that never succeeded,
    // and send somebody to reinstall an App they already have.
    const data = await unwrapBody(
      heyApiSdk.findInstallations(),
      InstallationsErrors.FETCH_LIST_FAILED,
    );
    return data.map(toEntity);
  }

  /**
   * Start a GitHub App install: the API mints a single-use `state` for this
   * person in this workspace and answers with the App's install URL carrying
   * it. Called on click, never on render — each call is a key in Redis.
   */
  @MapApiError(InstallationsErrors.START_FAILED)
  async startInstall(): Promise<InstallationStart> {
    const data = await unwrapBody(heyApiSdk.startInstallation(), InstallationsErrors.START_FAILED);
    return { url: data.url, state: data.state, expiresAt: new Date(data.expiresAt) };
  }

  /**
   * Attach the installation GitHub just created to this workspace.
   *
   * All three values come off the install redirect. The `state` is the one
   * `startInstall` minted, and proves this person started this install; the
   * `code` proves the caller can see the installation and is exchanged once,
   * server-side, then discarded — it is never stored, and re-posting the same
   * installation refreshes what GitHub reports about it rather than
   * duplicating it.
   */
  @MapApiError(InstallationsErrors.CONNECT_FAILED)
  async connect(callback: InstallationCallback): Promise<InstallationEntity> {
    const { githubInstallationId, code, state } = callback;
    const data = await unwrapBody(
      heyApiSdk.connectInstallation({ body: { githubInstallationId, code, state } }),
      InstallationsErrors.CONNECT_FAILED,
    );
    return toEntity(data);
  }

  @MapApiError(InstallationsErrors.FETCH_REPOSITORIES_FAILED)
  async repositories(installationId: string): Promise<RepositoryEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.listInstallationRepositories({ path: { id: installationId } }),
      InstallationsErrors.FETCH_REPOSITORIES_FAILED,
    );
    return data.map(toRepository);
  }

  /**
   * One repository's branches, live from GitHub.
   *
   * Read when a repository is picked rather than for every repository on the
   * account: the API answers this uncached and one call per row of a picker
   * nobody has opened is a GitHub rate limit spent on nothing.
   */
  @MapApiError(InstallationsErrors.FETCH_BRANCHES_FAILED)
  async branches(installationId: string, githubRepoId: number): Promise<BranchEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.listRepositoryBranches({ path: { id: installationId, githubRepoId } }),
      InstallationsErrors.FETCH_BRANCHES_FAILED,
    );
    return data.map(toBranch);
  }
}

function toBranch(data: RepositoryBranchResponseDto): BranchEntity {
  return new BranchEntity(data.name, data.commitSha, data.protected, data.isDefault);
}
