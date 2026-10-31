import {
  heyApiSdk,
  type InstallationResponseDto,
  type RepositoryBranchResponseDto,
  type RepositoryResponseDto,
} from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
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
  findAll(): Promise<InstallationEntity[]> {
    return callApi(InstallationsErrors.FETCH_LIST_FAILED, async (api) => {
      // An absent body is a failed read, not an empty list — returning `[]` would
      // render "GitHub is not connected" over a request that never succeeded,
      // and send somebody to reinstall an App they already have.
      const data = await api.body(heyApiSdk.findInstallations());
      return data.map(toEntity);
    });
  }

  /**
   * Start a GitHub App install: the API mints a single-use `state` for this
   * person in this workspace and answers with the App's install URL carrying
   * it.
   */
  startInstall(): Promise<InstallationStart> {
    return callApi(InstallationsErrors.START_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.startInstallation());
      return { url: data.url, state: data.state, expiresAt: new Date(data.expiresAt) };
    });
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
  connect(callback: InstallationCallback): Promise<InstallationEntity> {
    return callApi(InstallationsErrors.CONNECT_FAILED, async (api) => {
      const { githubInstallationId, code, state } = callback;
      const data = await api.body(
        heyApiSdk.connectInstallation({ body: { githubInstallationId, code, state } }),
      );
      return toEntity(data);
    });
  }

  repositories(installationId: string): Promise<RepositoryEntity[]> {
    return callApi(InstallationsErrors.FETCH_REPOSITORIES_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.listInstallationRepositories({ path: { id: installationId } }),
      );
      return data.map(toRepository);
    });
  }

  /**
   * One repository's branches, live from GitHub.
   *
   * Read when a repository is picked rather than for every repository on the
   * account: the API answers this uncached and one call per row of a picker
   * nobody has opened is a GitHub rate limit spent on nothing.
   */
  branches(installationId: string, githubRepoId: number): Promise<BranchEntity[]> {
    return callApi(InstallationsErrors.FETCH_BRANCHES_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.listRepositoryBranches({ path: { id: installationId, githubRepoId } }),
      );
      return data.map(toBranch);
    });
  }
}

function toBranch(data: RepositoryBranchResponseDto): BranchEntity {
  return new BranchEntity(data.name, data.commitSha, data.protected, data.isDefault);
}
