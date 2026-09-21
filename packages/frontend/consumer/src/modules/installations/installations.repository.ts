import { heyApiClient } from '@oppenheimer/api-client';
import { AppError, MapApiError } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import {
  type InstallationAccountType,
  InstallationEntity,
  RepositoryEntity,
  type RepositorySelection,
} from './installation.entity';
import { InstallationsErrors } from './installations.errors';

/**
 * The wire shapes of `apps/api`'s github module, mirrored from
 * `InstallationResponseDto` and `RepositoryResponseDto`. Declared here because
 * the generated SDK does not cover these routes yet; regenerating
 * `@oppenheimer/api-client` is what replaces them.
 */
interface InstallationDto {
  id: string;
  organizationId: string;
  githubInstallationId: number;
  accountLogin: string;
  accountType: InstallationAccountType;
  repositorySelection: RepositorySelection;
  createdAt: string;
}

interface RepositoryDto {
  githubRepoId: number;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  archived: boolean;
  pushedAt: string | null;
}

const INSTALLATIONS_URL = '/api/v1/installations';

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
    const { data, error } = await heyApiClient.get<InstallationDto[]>({ url: INSTALLATIONS_URL });
    // An absent body is a failed read, not an empty list — returning `[]` would
    // render "GitHub is not connected" over a request that never succeeded,
    // and send somebody to reinstall an App they already have.
    if (error || !data) throw new AppError(InstallationsErrors.FETCH_LIST_FAILED);
    return data.map(toEntity);
  }

  /**
   * Attach the installation GitHub just created to this workspace.
   *
   * Both values come off the install redirect. The `code` proves the caller
   * can see the installation and is exchanged once, server-side, then
   * discarded — it is never stored, and re-posting the same installation
   * refreshes what GitHub reports about it rather than duplicating it.
   */
  @MapApiError(InstallationsErrors.CONNECT_FAILED)
  async connect(githubInstallationId: number, code: string): Promise<InstallationEntity> {
    const { data, error } = await heyApiClient.post<InstallationDto>({
      url: INSTALLATIONS_URL,
      body: { githubInstallationId, code },
    });
    if (error || !data) throw new AppError(InstallationsErrors.CONNECT_FAILED);
    return toEntity(data);
  }

  @MapApiError(InstallationsErrors.REMOVE_FAILED)
  async remove(id: string): Promise<void> {
    const { error } = await heyApiClient.delete({
      url: `${INSTALLATIONS_URL}/{id}`,
      path: { id },
    });
    if (error) throw new AppError(InstallationsErrors.REMOVE_FAILED);
  }

  @MapApiError(InstallationsErrors.FETCH_REPOSITORIES_FAILED)
  async repositories(installationId: string): Promise<RepositoryEntity[]> {
    const { data, error } = await heyApiClient.get<RepositoryDto[]>({
      url: `${INSTALLATIONS_URL}/{id}/repositories`,
      path: { id: installationId },
    });
    if (error || !data) throw new AppError(InstallationsErrors.FETCH_REPOSITORIES_FAILED);
    return data.map(toRepository);
  }
}
